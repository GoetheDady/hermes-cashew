import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ChatMessage,
  ErrorPayload,
  GatewayMessage,
  MessageCompletePayload,
  MessageDeltaPayload,
  SessionCreateResult,
  SessionListResult,
  SessionResumeResult,
  SessionSummary
} from '@hermes/shared'
import { type ConnectionState, GatewayClient } from './lib/gateway-client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

/** 后端 WS 代理地址。前端只连后端，由后端再桥接到 Hermes dashboard。 */
const BACKEND_WS = 'ws://localhost:8765/ws'

/**
 * 把网关回放的历史消息映射成界面用的对话消息。
 * 只保留用户与助手的可见文本，丢弃 tool / system 等噪声。
 *
 * @param history - session.create / session.resume 返回的 messages
 * @returns 渲染层用的 {@link ChatMessage} 数组
 */
function mapHistory(history: GatewayMessage[] | undefined): ChatMessage[] {
  if (!history) return []
  return history
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && (m.text ?? '').trim() !== '')
    .map((m) => ({ role: m.role as ChatMessage['role'], content: m.text ?? '' }))
}

/**
 * 聊天主界面：左侧会话历史 + 新建按钮，右侧对话区。
 *
 * 经后端 WS 代理与 Hermes 网关对话：连上后等 `gateway.ready` → `session.create`；
 * 发送用 `prompt.submit`，回复经 `message.delta`/`message.complete` 流式渲染；
 * 左侧用 `session.list` 列出历史、`session.resume` 切换、`session.create` 新建。
 */
function App(): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeStoredId, setActiveStoredId] = useState<string>('')
  const [input, setInput] = useState('')
  const [conn, setConn] = useState<ConnectionState>('connecting')
  const [ready, setReady] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clientRef = useRef<GatewayClient | null>(null)
  const sessionIdRef = useRef<string>('')
  // 滚动锚点：始终滚动到该元素可见，配合 ScrollArea 工作。
  const bottomRef = useRef<HTMLDivElement>(null)
  // 用 ref 镜像 isStreaming，供回调内同步读取（避免闭包拿到旧值）。
  const isStreamingRef = useRef(false)
  useEffect(() => {
    isStreamingRef.current = isStreaming
  }, [isStreaming])

  /** 拉取会话列表刷新左栏。 */
  const refreshSessions = useCallback(() => {
    clientRef.current
      ?.request<SessionListResult>('session.list')
      .then((res) => setSessions(res.sessions ?? []))
      .catch(() => {
        /* 列表拉取失败不阻塞对话，静默即可 */
      })
  }, [])

  /** 新建一个会话并切换过去。 */
  const newSession = useCallback(() => {
    const client = clientRef.current
    if (!client) return
    client
      .request<SessionCreateResult>('session.create', { source: 'hermes-desktop' })
      .then((res) => {
        sessionIdRef.current = res.session_id
        setActiveStoredId(res.stored_session_id ?? '')
        setMessages(mapHistory(res.messages))
        setError(null)
        refreshSessions()
      })
      .catch((e: Error) => setError(`新建会话失败：${e.message}`))
  }, [refreshSessions])

  /** 切换到某个历史会话（恢复其消息）。 */
  const selectSession = useCallback((storedId: string) => {
    const client = clientRef.current
    if (!client || isStreamingRef.current) return
    client
      .request<SessionResumeResult>('session.resume', { session_id: storedId })
      .then((res) => {
        sessionIdRef.current = res.session_id
        setActiveStoredId(storedId)
        setMessages(mapHistory(res.messages))
        setError(null)
      })
      .catch((e: Error) => setError(`打开会话失败：${e.message}`))
  }, [])

  // 建立连接、订阅事件，组件卸载时清理。整个生命周期只跑一次。
  useEffect(() => {
    const client = new GatewayClient()
    clientRef.current = client

    const offState = client.onState(setConn)

    // 握手完成：建首个会话 + 拉历史列表。
    const offReady = client.on('gateway.ready', () => {
      setReady(true)
      newSession()
    })

    const offDelta = client.on<MessageDeltaPayload>('message.delta', (evt) => {
      const text = evt.payload?.text ?? ''
      if (!text) return
      setMessages((prev) => appendToAssistant(prev, text))
    })

    const offComplete = client.on<MessageCompletePayload>('message.complete', (evt) => {
      const full = evt.payload?.text
      if (full) setMessages((prev) => replaceAssistant(prev, full))
      setIsStreaming(false)
      refreshSessions() // 标题/预览/新会话会在一轮结束后出现
    })

    const offError = client.on<ErrorPayload>('error', (evt) => {
      setError(evt.payload?.message ?? '网关返回错误')
      setIsStreaming(false)
    })

    client.connect(BACKEND_WS)

    return () => {
      offState()
      offReady()
      offDelta()
      offComplete()
      offError()
      client.close()
    }
  }, [newSession, refreshSessions])

  // 每次消息变化滚到底部。
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages])

  /** 发送当前输入：本地入列 + `prompt.submit`，回复走事件流。 */
  function sendMessage(): void {
    const text = input.trim()
    const client = clientRef.current
    if (text === '' || isStreaming || !ready || !client) return

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '' }
    ])
    setInput('')
    setError(null)
    setIsStreaming(true)

    client.request('prompt.submit', { session_id: sessionIdRef.current, text }).catch((e: Error) => {
      setError(`发送失败：${e.message}`)
      setIsStreaming(false)
      setMessages((prev) => dropEmptyAssistant(prev))
    })
  }

  const canSend = ready && !isStreaming && input.trim() !== ''

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* 左栏：新建按钮 + 会话历史列表 */}
      <aside className="flex w-60 flex-col border-r">
        <div className="p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={newSession}
            disabled={!ready || isStreaming}
          >
            ＋ 新建会话
          </Button>
        </div>
        <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">会话历史</div>
        <ScrollArea className="min-h-0 flex-1">
          <nav className="space-y-0.5 px-2 pb-3">
            {sessions.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">暂无历史会话</p>
            )}
            {sessions.map((s) => (
              <Button
                key={s.id}
                variant={s.id === activeStoredId ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start truncate"
                onClick={() => selectSession(s.id)}
                disabled={isStreaming}
                title={s.title || s.preview || s.id}
              >
                {s.title || s.preview || '未命名会话'}
              </Button>
            ))}
          </nav>
        </ScrollArea>
      </aside>

      {/* 右栏：对话区 */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h1 className="text-sm font-semibold">Hermes</h1>
          <StatusBadge conn={conn} ready={ready} />
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 px-4 py-4">
            {messages.length === 0 && (
              <p className="mt-20 text-center text-sm text-muted-foreground">
                {ready ? '开始和 Hermes 对话吧' : '正在连接 Hermes…'}
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={cn(
                    'max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm',
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-card text-card-foreground'
                  )}
                >
                  {m.content || (isStreaming ? '…' : '')}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {error && (
          <div className="mx-4 mb-2 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <footer className="border-t p-3">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enter 发送，Shift+Enter 换行。
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              rows={1}
              placeholder={ready ? '输入消息，Enter 发送，Shift+Enter 换行' : '连接中…'}
              className="flex-1 resize-none min-h-0"
            />
            <Button size="sm" onClick={sendMessage} disabled={!canSend}>
              发送
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}

/** 右上角连接状态小标。 */
function StatusBadge({ conn, ready }: { conn: ConnectionState; ready: boolean }): React.JSX.Element {
  const label =
    conn === 'open' && ready
      ? '已连接'
      : conn === 'connecting'
        ? '连接中'
        : conn === 'open'
          ? '握手中'
          : '已断开'

  const variant =
    conn === 'open' && ready
      ? 'default'
      : conn === 'closed' || conn === 'error'
        ? 'destructive'
        : 'secondary'

  return (
    <Badge variant={variant} className="text-xs">
      {label}
    </Badge>
  )
}

/** 把增量文本追加到最后一条 assistant 消息。 */
function appendToAssistant(messages: ChatMessage[], text: string): ChatMessage[] {
  const next = [...messages]
  const last = next[next.length - 1]
  if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: last.content + text }
  return next
}

/** 用完整文本替换最后一条 assistant 消息。 */
function replaceAssistant(messages: ChatMessage[], text: string): ChatMessage[] {
  const next = [...messages]
  const last = next[next.length - 1]
  if (last?.role === 'assistant') next[next.length - 1] = { role: 'assistant', content: text }
  return next
}

/** 移除末尾的空 assistant 占位（发送失败时用）。 */
function dropEmptyAssistant(messages: ChatMessage[]): ChatMessage[] {
  const last = messages[messages.length - 1]
  return last?.role === 'assistant' && last.content === '' ? messages.slice(0, -1) : messages
}

export default App
