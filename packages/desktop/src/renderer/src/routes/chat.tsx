import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGateway } from '@/hooks/use-gateway'
import { useSessions } from '@/hooks/use-sessions'
import { useConversation } from '@/hooks/use-conversation'
import { useConfigStore } from '@/stores/use-config-store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from '@/components/message-bubble'
import { SessionSidebar } from '@/components/session-sidebar'
import { ConfigBar } from '@/components/config-bar'
import { LoaderCircle, Settings } from 'lucide-react'

/**
 * 聊天页面：左侧会话历史 + 右侧对话区。
 *
 * 组合 useGateway / useSessions / useConversation 三个业务 hook，
 * gateway.ready 时自动创建首个会话，消息发送/流式接收由 conversation hook 管理。
 */
export function Chat(): React.JSX.Element {
  const navigate = useNavigate()
  const [input, setInput] = useState('')

  /** 共享的运行时 session_id ref：useSessions 写入，useConversation 读取。 */
  const sessionIdRef = useRef<string>('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // ── 业务 hooks ──
  const { clientRef, conn, ready, error: gatewayError, reconnect, clearError } = useGateway()
  const sessions = useSessions(clientRef, sessionIdRef)
  const conversation = useConversation(clientRef, sessionIdRef, ready, sessions.refreshSessions)

  const {
    messages,
    isStreaming,
    thinkingStartedAt,
    sendMessage,
    setMessages,
    sendError: conversationError
  } = conversation

  // 合并错误消息。
  const error = gatewayError ?? conversationError
  const clearCombinedError = useCallback(() => {
    clearError()
    conversation.clearSendError()
  }, [clearError, conversation.clearSendError])

  // ── 初始化：gateway ready 时新建会话 + 拉配置 ──
  const hasInitialized = useRef(false)
  useEffect(() => {
    if (!ready || hasInitialized.current) return
    hasInitialized.current = true

    sessions.newSession().then((msgs) => setMessages(msgs)).catch(() => {})

    const client = clientRef.current
    if (client) {
      void useConfigStore.getState().fetchModelOptions(client)
      void useConfigStore.getState().fetchReasoningConfig(client)
    }
  }, [ready, sessions, setMessages, clientRef])

  // ── 滚动到底部 ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages])

  // ── 会话操作 ──
  const handleNewSession = useCallback(() => {
    sessions.newSession().then((msgs) => {
      setMessages(msgs)
      clearCombinedError()
    }).catch(() => {})
  }, [sessions, setMessages, clearCombinedError])

  const handleSelectSession = useCallback(
    (storedId: string) => {
      if (isStreaming || sessions.isSessionLoading) return
      clearCombinedError()
      sessions.selectSession(storedId).then((msgs) => {
        if (msgs) setMessages(msgs)
      }).catch(() => {})
    },
    [sessions, setMessages, isStreaming, clearCombinedError]
  )

  // ── 发送消息 ──
  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text) return
    clearCombinedError()
    sendMessage(text)
    setInput('')
  }, [input, sendMessage, clearCombinedError])

  const canSend = ready && !isStreaming && !sessions.isSessionLoading && input.trim() !== ''

  return (
    <>
      <SessionSidebar
        sessions={sessions.sessions}
        sessionsTotal={sessions.sessionsTotal}
        hasMoreSessions={sessions.hasMoreSessions}
        isLoadingMore={sessions.isLoadingMore}
        activeStoredId={sessions.activeStoredId}
        ready={ready}
        isStreaming={isStreaming}
        isSessionLoading={sessions.isSessionLoading}
        conn={conn}
        onNewSession={handleNewSession}
        onSelectSession={handleSelectSession}
        onLoadMore={sessions.loadMoreSessions}
        onReconnect={reconnect}
        footerSlot={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/settings')}
          >
            <Settings className="size-3.5" />
            设置
          </Button>
        }
      />

      {/* 右栏：对话区 */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="h-8 shrink-0" />
        <div className="relative min-h-0 flex-1 px-3">
          <ScrollArea className="h-full">
            <div className="mx-auto max-w-3xl space-y-3 px-4 py-4">
              {messages.length === 0 && (
                <p className="mt-20 text-center text-sm text-muted-foreground">
                  {ready ? '开始和 Hermes 对话吧' : '正在连接 Hermes…'}
                </p>
              )}
              {messages.map((m, i) => {
                const isLast = i === messages.length - 1
                const isLastStreaming = isLast && isStreaming && m.role === 'assistant'
                return (
                  <MessageBubble
                    key={m.id ?? i}
                    message={m}
                    isStreaming={isLastStreaming}
                    thinkingStartedAt={isLastStreaming ? thinkingStartedAt : null}
                  />
                )
              })}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
          {sessions.isSessionLoading && <SessionPageLoading />}
        </div>

        {error && (
          <div className="mx-4 mb-2 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <footer className="p-3">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-xl border bg-card px-3 pb-2.5 pt-2.5 shadow-sm">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                rows={1}
                placeholder={
                  sessions.isSessionLoading
                    ? '正在打开会话…'
                    : ready
                      ? '输入消息，Enter 发送，Shift+Enter 换行'
                      : '连接中…'
                }
                className="min-h-0 resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                disabled={sessions.isSessionLoading}
              />
              <div className="flex items-end justify-between gap-2 pt-1">
                {ready && !sessions.isSessionLoading ? <ConfigBar clientRef={clientRef} /> : <div />}
                <Button size="sm" onClick={handleSend} disabled={!canSend} className="shrink-0">
                  发送
                </Button>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

/**
 * 会话切换期间覆盖对话区的页面级 loading。
 */
function SessionPageLoading(): React.JSX.Element {
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm text-card-foreground shadow-sm">
        <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
        <span>正在打开会话…</span>
      </div>
    </div>
  )
}
