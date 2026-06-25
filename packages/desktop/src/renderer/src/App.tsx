import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ChatMessage,
  ErrorPayload,
  GatewayMessage,
  MessageCompletePayload,
  MessageDeltaPayload,
  SessionCreateResult,
  SessionListResult,
  SessionResumeResult,
  SessionMessagesResult,
  SessionSummary,
  ThinkingDeltaPayload,
  ToolCompletePayload,
  ToolProgressPayload,
  ToolStartPayload
} from '@hermes/shared'
import {
  REASONING_LEVELS,
  REASONING_LABELS,
  type ReasoningLevel,
  appendReasoningPart,
  appendTextPart,
  chatMessageText,
  coerceThinkingText,
  completeAssistantParts,
  storedMessagesToChatMessages,
  textPart,
  upsertToolCallPart
} from '@hermes/shared'
import { type ConnectionState, GatewayClient } from './lib/gateway-client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { useConfigStore } from '@/stores/use-config-store'
import { MessageBubble } from '@/components/message-bubble'

/** 后端 WS 代理地址。前端只连后端，由后端再桥接到 Hermes dashboard。 */
const BACKEND_WS = 'ws://localhost:8765/ws'

/** 后端 HTTP 基址，用于拉取含 reasoning 的历史消息（REST 代理）。 */
const BACKEND_HTTP = 'http://localhost:8765'

/**
 * 通过后端 REST 代理拉取某会话的完整历史消息（含 reasoning）。
 * session.resume 的 messages 经网关简化丢弃了 reasoning，故历史思考走此 REST。
 *
 * @param storedId - 存储会话 ID
 * @returns 历史消息映射后的 ChatMessage 数组；失败抛错
 */
async function fetchSessionMessages(storedId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${BACKEND_HTTP}/api/sessions/${encodeURIComponent(storedId)}/messages`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as SessionMessagesResult
  return storedMessagesToChatMessages(data.messages ?? [])
}

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
    .map((m) => ({ role: m.role as ChatMessage['role'], parts: [textPart(m.text ?? '')] }))
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
  const [thinkingStartedAt, setThinkingStartedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clientRef = useRef<GatewayClient | null>(null)
  const sessionIdRef = useRef<string>('')
  // 思考内容累积 ref（跨多次 delta，同步到消息 parts）。
  const reasoningRef = useRef<string>('')
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

  /**
   * 切换到某个历史会话。
   *
   * 历史消息走 REST（含 reasoning，能恢复思考过程）；同时 session.resume
   * 绑定运行时 session_id 以便继续对话。REST 失败时回退到 resume 的简化消息。
   */
  const selectSession = useCallback((storedId: string) => {
    const client = clientRef.current
    if (!client || isStreamingRef.current) return

    // 并行：REST 拉完整历史 + resume 绑定运行时会话。
    const restPromise = fetchSessionMessages(storedId)
    const resumePromise = client.request<SessionResumeResult>('session.resume', {
      session_id: storedId
    })

    resumePromise
      .then((res) => {
        sessionIdRef.current = res.session_id
        setActiveStoredId(storedId)
        setError(null)
        // REST 成功用含 reasoning 的历史；失败回退到 resume 的简化消息。
        return restPromise
          .then((msgs) => setMessages(msgs))
          .catch(() => setMessages(mapHistory(res.messages)))
      })
      .catch((e: Error) => setError(`打开会话失败：${e.message}`))
  }, [])

  // 建立连接、订阅事件，组件卸载时清理。整个生命周期只跑一次。
  useEffect(() => {
    const client = new GatewayClient()
    clientRef.current = client

    const offState = client.onState(setConn)

    // 握手完成：建首个会话 + 拉历史列表 + 拉模型/配置。
    const offReady = client.on('gateway.ready', () => {
      setReady(true)
      newSession()
      // 并行拉取模型列表和思考强度配置（fire-and-forget，不阻塞 UI）
      void useConfigStore.getState().fetchModelOptions(client)
      void useConfigStore.getState().fetchReasoningConfig(client)
    })

    // 回合开始：清空思考累积
    const offStart = client.on('message.start', () => {
      reasoningRef.current = ''
      setThinkingStartedAt(Date.now())
    })

    const offDelta = client.on<MessageDeltaPayload>('message.delta', (evt) => {
      const text = evt.payload?.text ?? ''
      if (!text) return
      setMessages((prev) => appendTextToLastAssistant(prev, text))
    })

    // 思考增量（spinner 状态文本，过滤后只保留真实内容）
    const offThinking = client.on<ThinkingDeltaPayload>('thinking.delta', (evt) => {
      const raw = evt.payload?.text ?? ''
      const cleaned = coerceThinkingText(raw)
      if (!cleaned) return
      reasoningRef.current += cleaned
      setMessages((prev) => appendReasoningToLastAssistant(prev, cleaned))
    })

    // 推理增量（真实推理内容）
    const offReasoning = client.on<ThinkingDeltaPayload>('reasoning.delta', (evt) => {
      const raw = evt.payload?.text ?? ''
      if (!raw) return
      reasoningRef.current += raw
      setMessages((prev) => appendReasoningToLastAssistant(prev, raw))
    })

    const offToolStart = client.on<ToolStartPayload>('tool.start', (evt) => {
      setMessages((prev) => upsertToolOnLastAssistant(prev, evt.payload, 'running'))
    })

    const offToolProgress = client.on<ToolProgressPayload>('tool.progress', (evt) => {
      setMessages((prev) => upsertToolOnLastAssistant(prev, evt.payload, 'progress'))
    })

    const offToolComplete = client.on<ToolCompletePayload>('tool.complete', (evt) => {
      setMessages((prev) => upsertToolOnLastAssistant(prev, evt.payload, 'complete'))
    })

    const offComplete = client.on<MessageCompletePayload>('message.complete', (evt) => {
      const full = evt.payload?.text
      const reasoningComplete = evt.payload?.reasoning ?? reasoningRef.current
      if (full) {
        setMessages((prev) => replaceAssistantWithParts(prev, full, reasoningComplete))
      }
      reasoningRef.current = ''
      setThinkingStartedAt(null)
      setIsStreaming(false)
      refreshSessions()
    })

    const offError = client.on<ErrorPayload>('error', (evt) => {
      setError(evt.payload?.message ?? '网关返回错误')
      setThinkingStartedAt(null)
      setIsStreaming(false)
    })

    // React StrictMode 开发模式会立即执行一次 effect cleanup。把真正连接推迟到
    // 下一轮事件循环，避免探测性卸载关闭一个尚未建立的 WebSocket 并刷控制台噪声。
    const connectTimer = window.setTimeout(() => client.connect(BACKEND_WS), 0)

    return () => {
      window.clearTimeout(connectTimer)
      offState()
      offReady()
      offStart()
      offDelta()
      offThinking()
      offReasoning()
      offToolStart()
      offToolProgress()
      offToolComplete()
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
      { role: 'user', parts: [textPart(text)] },
      { role: 'assistant', parts: [] }
    ])
    setInput('')
    setError(null)
    setIsStreaming(true)

    client
      .request('prompt.submit', { session_id: sessionIdRef.current, text })
      .catch((e: Error) => {
        setError(`发送失败：${e.message}`)
        setIsStreaming(false)
        setMessages((prev) => dropEmptyAssistantParts(prev))
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

        {error && (
          <div className="mx-4 mb-2 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <footer className="border-t p-3">
          <div className="mx-auto max-w-3xl space-y-2">
            {/* 配置栏：模型选择 + 思考强度滑块 */}
            {ready && <ConfigBar clientRef={clientRef} />}

            {/* 输入栏 */}
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
          </div>
        </footer>
      </div>
    </div>
  )
}

/** 配置栏：模型选择 + 思考强度滑块。 */
function ConfigBar({
  clientRef
}: {
  clientRef: React.RefObject<GatewayClient | null>
}): React.JSX.Element {
  const providers = useConfigStore((s) => s.providers)
  const currentModel = useConfigStore((s) => s.currentModel)
  const currentProvider = useConfigStore((s) => s.currentProvider)
  const reasoningEffort = useConfigStore((s) => s.reasoningEffort)
  const setModel = useConfigStore((s) => s.setModel)
  const setReasoningEffort = useConfigStore((s) => s.setReasoningEffort)

  // 滑块本地拖拽状态：受控组件必须有 onValueChange，否则拖拽时视觉不更新。
  const [dragValue, setDragValue] = useState<number | null>(null)
  const sliderValue = dragValue ?? REASONING_LEVELS.indexOf(reasoningEffort)
  const effortLabel =
    REASONING_LABELS[
      dragValue != null ? (REASONING_LEVELS[dragValue] as ReasoningLevel) : reasoningEffort
    ]
  const selectedModelValue = selectedModelSelectValue(currentProvider, currentModel)

  // 构建按 provider 分组的模型列表
  const modelItems = useMemo(() => {
    const items: { providerSlug: string; providerName: string; modelId: string }[] = []
    for (const p of providers) {
      for (const m of p.models) {
        items.push({ providerSlug: p.slug, providerName: p.name, modelId: m })
      }
    }
    return items
  }, [providers])

  // 按 provider 分组
  const grouped = useMemo(() => {
    const map = new Map<string, typeof modelItems>()
    for (const item of modelItems) {
      const g = map.get(item.providerSlug)
      if (g) g.push(item)
      else map.set(item.providerSlug, [item])
    }
    return map
  }, [modelItems])

  const handleModelChange = (value: string): void => {
    const client = clientRef.current
    if (!client) return
    const [providerSlug, modelId] = value.split(':', 2)
    void setModel(client, providerSlug, modelId).catch(() => {
      /* 错误由 store 回滚 */
    })
  }

  const handleSliderChange = useCallback((value: number[]) => {
    setDragValue(value[0])
  }, [])

  const handleSliderCommit = useCallback(
    (value: number[]) => {
      setDragValue(null)
      const client = clientRef.current
      if (!client) return
      const effort = REASONING_LEVELS[value[0]] as ReasoningLevel
      void setReasoningEffort(client, effort).catch(() => {
        /* 错误由 store 回滚 */
      })
    },
    [clientRef, setReasoningEffort]
  )

  return (
    <div className="flex items-center gap-2">
      {/* 模型下拉 */}
      <Select
        value={selectedModelValue}
        onValueChange={handleModelChange}
        disabled={modelItems.length === 0}
      >
        <SelectTrigger className="h-7 text-xs max-w-[200px]">
          <SelectValue placeholder="选择模型…">
            {currentModel ? (currentModel.split('/').slice(-1)[0] ?? currentModel) : '选择模型…'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Array.from(grouped.entries()).map(([slug, items]) => (
            <SelectGroup key={slug}>
              <SelectLabel>{items[0]?.providerName ?? slug}</SelectLabel>
              {items.map((item) => (
                <SelectItem
                  key={`${item.providerSlug}:${item.modelId}`}
                  value={`${item.providerSlug}:${item.modelId}`}
                >
                  {item.modelId}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {/* 思考强度滑块 + 标签 */}
      <div className="flex items-center gap-1.5 min-w-[140px]">
        <Slider
          min={0}
          max={5}
          step={1}
          value={[sliderValue]}
          onValueChange={handleSliderChange}
          onValueCommit={handleSliderCommit}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
          {effortLabel}
        </span>
      </div>
    </div>
  )
}

/**
 * 把 store 里的当前模型转换为 SelectItem 使用的受控 value。
 *
 * @param providerSlug - 当前 provider slug
 * @param model - 当前模型；dashboard 可能返回 `provider/modelId`
 * @returns 下拉项 value；没有当前模型时返回空字符串以保持受控
 */
function selectedModelSelectValue(providerSlug: string, model: string): string {
  if (!providerSlug || !model) return ''
  const providerPrefix = `${providerSlug}/`
  const modelId = model.startsWith(providerPrefix) ? model.slice(providerPrefix.length) : model
  return `${providerSlug}:${modelId}`
}

/** 右上角连接状态小标。 */
function StatusBadge({
  conn,
  ready
}: {
  conn: ConnectionState
  ready: boolean
}): React.JSX.Element {
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

/** 追加正文 text delta 到最后一条 assistant 消息的 parts。 */
function appendTextToLastAssistant(messages: ChatMessage[], text: string): ChatMessage[] {
  const next = ensureLastAssistant(messages)
  const last = next[next.length - 1]
  if (last?.role === 'assistant') {
    next[next.length - 1] = { ...last, parts: appendTextPart(last.parts, text) }
  }
  return next
}

/** 追加 reasoning delta 到最后一条 assistant 消息的 parts。 */
function appendReasoningToLastAssistant(messages: ChatMessage[], text: string): ChatMessage[] {
  const next = ensureLastAssistant(messages)
  const last = next[next.length - 1]
  if (last?.role === 'assistant') {
    next[next.length - 1] = { ...last, parts: appendReasoningPart(last.parts, text) }
  }
  return next
}

/**
 * 新增或更新最后一条 assistant 消息里的工具调用片段。
 *
 * @param messages - 当前聊天消息
 * @param payload - gateway 工具事件 payload
 * @param phase - 工具事件阶段
 * @returns 更新后的聊天消息
 */
function upsertToolOnLastAssistant(
  messages: ChatMessage[],
  payload: ToolStartPayload | ToolProgressPayload | ToolCompletePayload | undefined,
  phase: 'running' | 'progress' | 'complete'
): ChatMessage[] {
  const next = ensureLastAssistant(messages)
  const last = next[next.length - 1]
  if (last?.role === 'assistant') {
    next[next.length - 1] = { ...last, parts: upsertToolCallPart(last.parts, payload, phase) }
  }
  return next
}

/**
 * 确保消息尾部有一条 assistant 占位，便于乱序/缺占位的流式事件落位。
 *
 * @param messages - 当前聊天消息
 * @returns 尾部为 assistant 的新消息数组
 */
function ensureLastAssistant(messages: ChatMessage[]): ChatMessage[] {
  const last = messages[messages.length - 1]
  if (last?.role === 'assistant') return [...messages]
  return [...messages, { role: 'assistant', parts: [] }]
}

/** 用完整文本替换最后一条 assistant 消息（message.complete 时用）。 */
function replaceAssistantWithParts(
  messages: ChatMessage[],
  text: string,
  reasoningText: string
): ChatMessage[] {
  const next = ensureLastAssistant(messages)
  const last = next[next.length - 1]
  if (last?.role !== 'assistant') return next
  next[next.length - 1] = {
    ...last,
    parts: completeAssistantParts(last.parts, text, reasoningText)
  }
  return next
}

/** 移除末尾的空 assistant 占位（发送失败时用）。 */
function dropEmptyAssistantParts(messages: ChatMessage[]): ChatMessage[] {
  const last = messages[messages.length - 1]
  if (last?.role !== 'assistant') return messages
  const text = chatMessageText(last)
  const hasReasoning = last.parts.some((p) => p.type === 'reasoning')
  const hasToolCall = last.parts.some((p) => p.type === 'tool-call')
  return text === '' && !hasReasoning && !hasToolCall ? messages.slice(0, -1) : messages
}

export default App
