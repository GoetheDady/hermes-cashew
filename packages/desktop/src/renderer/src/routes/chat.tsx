import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage, GatewayMessage, SessionCreateResult } from '@hermes/shared'
import { textPart } from '@hermes/shared'
import { useGateway } from '@/hooks/use-gateway'
import { useConversation } from '@/hooks/use-conversation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from '@/components/message-bubble'
import { LoaderCircle, RotateCcw } from 'lucide-react'

/**
 * 聊天页面：打开即进入新的 Hermes 对话。
 *
 * 首屏只保留当前对话、输入框和必要的连接异常恢复；Session History、
 * 设置、模型与 reasoning 控制不参与默认产品表面。
 *
 * @returns 聊天页 React 元素
 */
export function Chat(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [isSessionStarting, setIsSessionStarting] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [hasActiveSession, setHasActiveSession] = useState(false)
  const [sessionRetryKey, setSessionRetryKey] = useState(0)

  /** 共享的运行时 session_id ref：当前页面创建，useConversation 读取。 */
  const sessionIdRef = useRef<string>('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── 业务 hooks ──
  const { clientRef, conn, ready, error: gatewayError, reconnect, clearError } = useGateway()
  const conversation = useConversation(clientRef, sessionIdRef, ready)

  const {
    messages,
    isStreaming,
    thinkingStartedAt,
    sendMessage,
    setMessages,
    sendError: conversationError
  } = conversation

  const clearCombinedError = useCallback(() => {
    clearError()
    conversation.clearSendError()
    setSessionError(null)
  }, [clearError, conversation.clearSendError])

  // ── 初始化：gateway ready 时自动创建当前新对话 ──
  const hasInitialized = useRef(false)
  useEffect(() => {
    if (!ready) {
      hasInitialized.current = false
      setHasActiveSession(false)
      setIsSessionStarting(false)
      return
    }

    if (!ready || hasInitialized.current) return
    hasInitialized.current = true

    const client = clientRef.current
    if (!client) return

    setIsSessionStarting(true)
    setSessionError(null)
    client
      .request<SessionCreateResult>('session.create', { source: 'hermes-desktop' })
      .then((res) => {
        sessionIdRef.current = res.session_id
        setMessages(mapHistory(res.messages))
        setHasActiveSession(true)
        window.setTimeout(() => inputRef.current?.focus(), 0)
      })
      .catch((e: Error) => {
        hasInitialized.current = false
        setHasActiveSession(false)
        setSessionError(`新建对话失败：${e.message}`)
      })
      .finally(() => setIsSessionStarting(false))
  }, [ready, clientRef, setMessages, sessionRetryKey])

  // ── 滚动到底部 ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages])

  // ── 发送消息 ──
  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text) return
    clearCombinedError()
    sendMessage(text)
    setInput('')
  }, [input, sendMessage, clearCombinedError])

  const hasConnectionProblem = conn === 'closed' || conn === 'error'
  const canSend = ready && hasActiveSession && !isSessionStarting && !isStreaming && input.trim() !== ''
  const statusText = sessionError ?? gatewayError ?? conversationError
  const placeholder = !ready
    ? '正在连接 Hermes…'
    : isSessionStarting
      ? '正在开启新对话…'
      : '问 Hermes 点什么…'

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="h-8 shrink-0" />
      <div className="relative min-h-0 flex-1 px-3">
        <ScrollArea className="h-full">
          <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-4">
            {messages.length === 0 ? (
              <EmptyConversation ready={ready} isSessionStarting={isSessionStarting} />
            ) : (
              <div className="space-y-3">
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
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      {(statusText || hasConnectionProblem) && (
        <div className="mx-auto mb-2 flex w-full max-w-3xl items-center justify-between gap-3 px-4 text-xs">
          <span className="min-w-0 break-words text-destructive">
            {statusText ?? '连接已断开'}
          </span>
          {hasConnectionProblem ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1.5 px-2 text-xs"
              onClick={() => {
                clearCombinedError()
                reconnect()
              }}
            >
              <RotateCcw className="size-3" />
              重试连接
            </Button>
          ) : sessionError ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1.5 px-2 text-xs"
              onClick={() => {
                setSessionError(null)
                setSessionRetryKey((key) => key + 1)
              }}
            >
              <RotateCcw className="size-3" />
              重试开启
            </Button>
          ) : null}
        </div>
      )}

      <footer className="p-3">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-xl border bg-card px-3 pb-2.5 pt-2.5 shadow-sm">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              rows={1}
              placeholder={placeholder}
              className="min-h-0 resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
              disabled={!ready || isSessionStarting || !hasActiveSession}
            />
            <div className="flex items-end justify-end gap-2 pt-1">
              <Button size="sm" onClick={handleSend} disabled={!canSend} className="shrink-0">
                发送
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

/**
 * 空对话占位：只表达当前对话是否可输入，避免引入历史或设置概念。
 *
 * @param ready - 网关握手是否已完成
 * @param isSessionStarting - 当前新对话是否仍在创建中
 * @returns 空对话状态 React 元素
 */
function EmptyConversation({
  ready,
  isSessionStarting
}: {
  ready: boolean
  isSessionStarting: boolean
}): React.JSX.Element {
  const text = !ready
    ? '正在连接 Hermes…'
    : isSessionStarting
      ? '正在开启新对话…'
      : '开始和 Hermes 对话吧'

  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {(!ready || isSessionStarting) && <LoaderCircle className="size-4 animate-spin" />}
        <span>{text}</span>
      </div>
    </div>
  )
}

/**
 * 把网关回放的历史消息映射成界面用的对话消息。
 *
 * 新对话通常没有历史；保留该映射是为了兼容 dashboard 在 session.create
 * 返回欢迎消息或恢复片段时，当前对话仍能显示可见内容。
 *
 * @param history - session.create 返回的网关消息
 * @returns 渲染层可直接消费的消息列表
 */
function mapHistory(history: GatewayMessage[] | undefined): ChatMessage[] {
  if (!history) return []
  return history
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && (m.text ?? '').trim() !== '')
    .map((m) => ({ role: m.role as ChatMessage['role'], parts: [textPart(m.text ?? '')] }))
}
