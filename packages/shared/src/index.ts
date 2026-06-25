/**
 * @hermes/shared —— 前端、后端共用的 Hermes 网关协议类型。
 *
 * Hermes dashboard 通过 `/api/ws` 暴露 JSON-RPC 2.0 over WebSocket 网关。
 * 这里定义客户端与桥接后端共用的帧、事件与方法返回结构。
 * 协议来源：Hermes 的 tui_gateway/server.py 与 apps/shared/src/json-rpc-gateway.ts。
 */

/** 一条对话消息（渲染层内存历史用）。 */
export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  parts: ChatMessagePart[]
}

/** 消息内容片段类型。 */
export type ChatMessagePart = TextPart | ReasoningPart | ToolCallPart

/** 正文片段。 */
export interface TextPart {
  type: 'text'
  text: string
}

/** 思考/推理片段。 */
export interface ReasoningPart {
  type: 'reasoning'
  text: string
}

/** 工具调用片段。 */
export interface ToolCallPart {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  args?: unknown
  argsText?: string
  result?: unknown
  resultText?: string
  summary?: string
  context?: string
  preview?: string
  inlineDiff?: string
  durationS?: number
  isError?: boolean
}

/** 创建正文片段。 */
export function textPart(text: string): TextPart {
  return { type: 'text', text }
}

/** 创建思考片段。 */
export function reasoningPart(text: string): ReasoningPart {
  return { type: 'reasoning', text }
}

/**
 * 创建工具调用片段。
 *
 * @param part - 工具调用的规范化字段
 * @returns 渲染层可直接消费的工具调用片段
 */
export function toolCallPart(part: Omit<ToolCallPart, 'type'>): ToolCallPart {
  return { type: 'tool-call', ...part }
}

/** 拼接消息中所有 text 片段的文本。 */
export function chatMessageText(message: ChatMessage): string {
  return message.parts
    .filter((p): p is TextPart => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

/** 在 parts 数组末尾追加文本增量（用于流式 text delta）。 */
export function appendTextPart(parts: ChatMessagePart[], delta: string): ChatMessagePart[] {
  const last = parts[parts.length - 1]
  if (last?.type === 'text') {
    return [...parts.slice(0, -1), { ...last, text: last.text + delta }]
  }
  return [...parts, textPart(delta)]
}

/** 在 parts 数组末尾追加思考增量（用于流式 reasoning/thinking delta）。 */
export function appendReasoningPart(parts: ChatMessagePart[], delta: string): ChatMessagePart[] {
  const last = parts[parts.length - 1]
  if (last?.type === 'reasoning') {
    return [...parts.slice(0, -1), { ...last, text: last.text + delta }]
  }
  return [...parts, reasoningPart(delta)]
}

/** `tool.start` 事件的 payload。 */
export interface ToolStartPayload {
  tool_id?: string
  name?: string
  context?: string
  args?: unknown
  args_text?: string
  todos?: unknown[]
}

/** `tool.progress` 事件的 payload。 */
export interface ToolProgressPayload {
  name?: string
  preview?: string
}

/** `tool.complete` 事件的 payload。 */
export interface ToolCompletePayload {
  tool_id?: string
  name?: string
  duration_s?: number
  error?: string
  summary?: string
  result_text?: string
  inline_diff?: string
  todos?: unknown[]
}

/** 工具事件 payload 的通用形态。 */
export type ToolEventPayload = ToolStartPayload | ToolProgressPayload | ToolCompletePayload

/**
 * 新增或更新一个工具调用片段。
 *
 * @param parts - 当前 assistant 消息的 parts
 * @param payload - gateway 工具事件 payload
 * @param phase - 工具事件阶段
 * @returns 带有工具调用片段的新 parts 数组
 */
export function upsertToolCallPart(
  parts: ChatMessagePart[],
  payload: ToolEventPayload | undefined,
  phase: 'running' | 'progress' | 'complete'
): ChatMessagePart[] {
  const next = [...parts]
  const toolCallId = toolEventId(payload)
  const toolName = toolEventName(payload)
  const index = findToolCallPartIndex(next, toolCallId, toolName)
  const previous =
    index >= 0 && next[index]?.type === 'tool-call' ? (next[index] as ToolCallPart) : undefined
  const fallbackId =
    previous?.toolCallId ||
    toolCallId ||
    `live-tool-${next.filter((p) => p.type === 'tool-call').length}`
  const base = buildToolCallPart(previous, fallbackId, toolName, payload, phase)

  if (index >= 0) {
    next[index] = base
    return next
  }

  return [...next, base]
}

/**
 * 用回合完成事件的完整文本更新 assistant parts，同时保留工具调用相对位置。
 *
 * @param parts - 当前 assistant parts
 * @param text - message.complete 携带的完整正文
 * @param reasoningText - message.complete 携带或累积得到的思考文本
 * @returns 更新后的 assistant parts
 */
export function completeAssistantParts(
  parts: ChatMessagePart[],
  text: string,
  reasoningText: string
): ChatMessagePart[] {
  const next = [...parts]

  if (reasoningText && !next.some((part) => part.type === 'reasoning')) {
    next.unshift(reasoningPart(reasoningText))
  }

  if (!text) return next

  for (let i = next.length - 1; i >= 0; i -= 1) {
    if (next[i]?.type === 'text') {
      next[i] = textPart(text)
      return next
    }
  }

  return [...next, textPart(text)]
}

/** 从 db 原始 content 提取可显示文本（兼容字符串与结构化数组）。 */
export function storedContentText(content: string | unknown[] | undefined): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === 'string') return c
        if (c && typeof c === 'object' && 'text' in c)
          return String((c as { text: unknown }).text ?? '')
        return ''
      })
      .join('')
  }
  return ''
}

/**
 * 把一条历史原始消息映射为渲染用的 ChatMessage（含 reasoning）。
 * 只处理 user / assistant，其余（tool/system）返回 null 由调用方过滤。
 */
export function storedMessageToChatMessage(m: StoredMessage): ChatMessage | null {
  if (m.role !== 'user' && m.role !== 'assistant') return null

  const body = storedContentText(m.content) || (m.text ?? '')
  const reasoning =
    m.reasoning ||
    m.reasoning_content ||
    (typeof m.reasoning_details === 'string' ? m.reasoning_details : '')

  const parts: ChatMessagePart[] = []
  if (m.role === 'assistant' && reasoning) {
    parts.push(reasoningPart(reasoning))
  }
  if (body.trim()) {
    parts.push(textPart(body))
  }

  if (parts.length === 0) return null
  return { role: m.role, parts }
}

/**
 * 把一组历史原始消息映射为渲染用对话消息，并把 tool role 结果配回 assistant 工具调用。
 *
 * @param history - REST 返回的原始消息列表
 * @returns 可渲染的聊天消息；tool/system 行不会单独暴露为顶层气泡
 */
export function storedMessagesToChatMessages(history: StoredMessage[]): ChatMessage[] {
  const messages: ChatMessage[] = []
  let canMergeAssistantTurn = false

  history.forEach((stored, index) => {
    if (stored.role === 'user') {
      const message = storedMessageToChatMessage(stored)
      if (message) messages.push(message)
      canMergeAssistantTurn = false
      return
    }

    if (stored.role === 'assistant') {
      const message = storedMessageToChatMessage(stored)
      const toolParts = storedToolCallsToParts(stored.tool_calls)
      const parts = [...(message?.parts ?? []), ...toolParts]

      if (parts.length > 0) {
        appendStoredAssistantParts(messages, parts, canMergeAssistantTurn)
      }
      canMergeAssistantTurn = true
      return
    }

    if (stored.role === 'tool') {
      applyStoredToolResult(messages, stored, index)
      canMergeAssistantTurn = true
      return
    }

    canMergeAssistantTurn = false
  })

  return messages
}

/**
 * 把历史中的 assistant 片段追加到当前 assistant 轮次；遇到新用户消息后才开启新轮。
 *
 * @param messages - 已累积的渲染消息
 * @param parts - 当前历史 assistant 行解析出的片段
 * @param canMergeAssistantTurn - 当前行是否仍属于上一条 assistant 工具轮次
 * @returns 无返回值，直接更新 messages
 */
function appendStoredAssistantParts(
  messages: ChatMessage[],
  parts: ChatMessagePart[],
  canMergeAssistantTurn: boolean
): void {
  const last = messages[messages.length - 1]
  if (canMergeAssistantTurn && last?.role === 'assistant') {
    messages[messages.length - 1] = { ...last, parts: [...last.parts, ...parts] }
    return
  }

  messages.push({ role: 'assistant', parts })
}

/**
 * 判断未知值是否为普通对象。
 *
 * @param value - 待判断的未知值
 * @returns 为非数组对象时返回 true
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

/**
 * 读取工具事件里的调用 id。
 *
 * @param payload - gateway 工具事件 payload
 * @returns 工具调用 id；缺失时返回空字符串
 */
function toolEventId(payload: ToolEventPayload | undefined): string {
  if (!payload || !('tool_id' in payload) || typeof payload.tool_id !== 'string') return ''
  return payload.tool_id
}

/**
 * 读取工具事件里的工具名。
 *
 * @param payload - gateway 工具事件 payload
 * @returns 工具名；缺失时返回通用名称
 */
function toolEventName(payload: ToolEventPayload | undefined): string {
  if (
    !payload ||
    !('name' in payload) ||
    typeof payload.name !== 'string' ||
    !payload.name.trim()
  ) {
    return 'tool'
  }
  return payload.name
}

/**
 * 查找应被工具事件更新的片段。
 *
 * @param parts - 当前 assistant parts
 * @param toolCallId - 工具调用 id
 * @param toolName - 工具名
 * @returns 匹配片段索引；找不到返回 -1
 */
function findToolCallPartIndex(
  parts: ChatMessagePart[],
  toolCallId: string,
  toolName: string
): number {
  if (toolCallId) {
    const byId = parts.findIndex(
      (part) => part.type === 'tool-call' && part.toolCallId === toolCallId
    )
    if (byId >= 0) return byId
  }

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i]
    if (part?.type === 'tool-call' && part.toolName === toolName && part.result === undefined)
      return i
  }

  return -1
}

/**
 * 从工具事件里提取参数对象与原始文本。
 *
 * @param payload - gateway 工具事件 payload
 * @param previous - 既有工具片段
 * @returns 参数对象与原始参数文本
 */
function toolEventArgs(
  payload: ToolEventPayload | undefined,
  previous: ToolCallPart | undefined
): { args: unknown; argsText: string } {
  if (
    payload &&
    'args_text' in payload &&
    typeof payload.args_text === 'string' &&
    payload.args_text.trim()
  ) {
    return {
      args: parseArgsObject(payload.args_text),
      argsText: payload.args_text
    }
  }
  if (payload && 'args' in payload && payload.args !== undefined) {
    const args = parseArgsObject(payload.args)
    return {
      args,
      argsText: Object.keys(args).length ? JSON.stringify(args) : ''
    }
  }
  return { args: previous?.args ?? {}, argsText: previous?.argsText ?? '' }
}

/**
 * 根据事件阶段构造工具调用片段。
 *
 * @param previous - 既有工具片段
 * @param toolCallId - 本次工具调用 id
 * @param toolName - 本次工具名
 * @param payload - gateway 工具事件 payload
 * @param phase - 工具事件阶段
 * @returns 规范化后的工具调用片段
 */
function buildToolCallPart(
  previous: ToolCallPart | undefined,
  toolCallId: string,
  toolName: string,
  payload: ToolEventPayload | undefined,
  phase: 'running' | 'progress' | 'complete'
): ToolCallPart {
  const { args, argsText } = toolEventArgs(payload, previous)
  const context =
    payload && 'context' in payload && typeof payload.context === 'string'
      ? payload.context
      : previous?.context
  const preview =
    payload && 'preview' in payload && typeof payload.preview === 'string'
      ? payload.preview
      : previous?.preview
  const summary =
    payload && 'summary' in payload && typeof payload.summary === 'string'
      ? payload.summary
      : previous?.summary
  const resultText =
    payload && 'result_text' in payload && typeof payload.result_text === 'string'
      ? payload.result_text
      : previous?.resultText
  const error =
    payload && 'error' in payload && typeof payload.error === 'string' ? payload.error : ''
  const inlineDiff =
    payload && 'inline_diff' in payload && typeof payload.inline_diff === 'string'
      ? payload.inline_diff
      : previous?.inlineDiff
  const durationS =
    payload && 'duration_s' in payload && typeof payload.duration_s === 'number'
      ? payload.duration_s
      : previous?.durationS
  const result =
    phase === 'complete'
      ? resultText || summary || error || previous?.result || ''
      : previous?.result

  return toolCallPart({
    toolCallId,
    toolName: toolName === 'tool' ? (previous?.toolName ?? toolName) : toolName,
    args,
    argsText,
    ...(context ? { context } : {}),
    ...(preview ? { preview } : {}),
    ...(summary ? { summary } : {}),
    ...(resultText ? { resultText } : {}),
    ...(inlineDiff ? { inlineDiff } : {}),
    ...(durationS != null ? { durationS } : {}),
    ...(phase === 'complete' ? { result, isError: Boolean(error) } : {})
  })
}

/**
 * 从 JSON 字符串或对象中提取工具参数。
 *
 * @param value - 原始 arguments/args/input 字段
 * @returns 解析后的对象；无法解析时返回空对象
 */
function parseArgsObject(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value
  if (typeof value !== 'string' || !value.trim()) return {}

  try {
    const parsed = JSON.parse(value) as unknown
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * 取第一个非空字符串字段。
 *
 * @param record - 来源对象
 * @param keys - 候选字段名
 * @returns 第一个非空字符串；没有则返回空字符串
 */
function firstStringField(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return ''
}

/**
 * 从 assistant 原始 tool_calls 字段生成工具调用片段。
 *
 * @param toolCalls - 原始工具调用列表
 * @returns 规范化后的工具调用片段
 */
function storedToolCallsToParts(toolCalls: unknown[] | undefined): ToolCallPart[] {
  if (!Array.isArray(toolCalls)) return []

  return toolCalls
    .map((call, index) => storedToolCallToPart(call, index))
    .filter((part): part is ToolCallPart => part !== null)
}

/**
 * 从单个原始 tool_call 对象生成工具调用片段。
 *
 * @param call - 原始工具调用对象
 * @param index - 缺失 id 时的稳定兜底序号
 * @returns 规范化后的工具调用片段；无法识别时返回 null
 */
function storedToolCallToPart(call: unknown, index: number): ToolCallPart | null {
  if (!isRecord(call)) return null

  const fn = isRecord(call.function) ? call.function : {}
  const input = isRecord(call.input) ? call.input : {}
  const toolName =
    firstStringField(call, ['name', 'tool_name']) ||
    firstStringField(fn, ['name']) ||
    firstStringField(input, ['name']) ||
    'tool'
  const toolCallId = firstStringField(call, ['id', 'tool_call_id']) || `stored-tool-${index}`
  const rawArgs =
    fn.arguments ?? call.arguments ?? call.args ?? input.args ?? input.arguments ?? input
  const args = parseArgsObject(rawArgs)
  const argsText =
    typeof rawArgs === 'string' ? rawArgs : Object.keys(args).length ? JSON.stringify(args) : ''

  return toolCallPart({
    toolCallId,
    toolName,
    args,
    argsText
  })
}

/**
 * 把 tool role 消息结果配回最近的 assistant 工具调用；找不到时创建降级工具行。
 *
 * @param messages - 已累积的渲染消息
 * @param stored - 原始 tool 消息
 * @param index - 缺失 id 时的稳定兜底序号
 * @returns 是否找到并更新了既有工具调用
 */
function applyStoredToolResult(
  messages: ChatMessage[],
  stored: StoredMessage,
  index: number
): boolean {
  const toolCallId = stored.tool_call_id
  const toolName = stored.tool_name || stored.name || 'tool'
  const result = storedContentText(stored.content) || stored.text || stored.context || ''

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message?.role !== 'assistant') continue

    const partIndex = message.parts.findIndex(
      (part) =>
        part.type === 'tool-call' &&
        ((toolCallId && part.toolCallId === toolCallId) ||
          (!toolCallId && part.toolName === toolName))
    )
    if (partIndex < 0) continue

    const parts = [...message.parts]
    parts[partIndex] = {
      ...parts[partIndex],
      result,
      isError: false
    } as ToolCallPart
    messages[i] = { ...message, parts }
    return true
  }

  messages.push({
    role: 'assistant',
    parts: [
      toolCallPart({
        toolCallId: toolCallId || `stored-tool-message-${index}`,
        toolName,
        result,
        isError: false
      })
    ]
  })
  return false
}

/** 网关推送的事件类型（已知集合 + 兜底字符串）。 */
export type GatewayEventName =
  | 'gateway.ready'
  | 'session.info'
  | 'message.start'
  | 'message.delta'
  | 'message.complete'
  | 'thinking.delta'
  | 'reasoning.delta'
  | 'reasoning.available'
  | 'tool.start'
  | 'tool.complete'
  | 'error'
  | (string & {})

/**
 * 网关事件。服务端以 `{jsonrpc, method:"event", params: GatewayEvent}` 推送，
 * `payload` 的结构随 `type` 而定。
 */
export interface GatewayEvent<P = unknown> {
  type: GatewayEventName
  session_id?: string
  payload?: P
}

/** JSON-RPC 帧：既覆盖请求/响应，也覆盖事件推送。 */
export interface JsonRpcFrame {
  jsonrpc?: '2.0'
  id?: number | string | null
  method?: string
  params?: GatewayEvent
  result?: unknown
  error?: { code?: number; message?: string }
}

/** `message.delta` 事件的 payload —— `text` 是本次增量文本。 */
export interface MessageDeltaPayload {
  text?: string
  rendered?: string
}

/** `message.complete` 事件的 payload —— `text` 是完整文本。 */
export interface MessageCompletePayload {
  text?: string
  rendered?: string
  reasoning?: string
  status?: 'complete' | 'interrupted' | 'error'
}

/** `thinking.delta` / `reasoning.delta` 事件的 payload。 */
export interface ThinkingDeltaPayload {
  text?: string
}

/** 匹配 thinking.delta 的 spinner 前缀，如 "(◔_◔) cogitating..."。 */
const SPINNER_PREFIX_RE = /^\([^)]+\)\s+\w+\.\.\.\s*/i

/** 过滤掉 thinking delta 中的 spinner 状态文本，只保留真正的推理内容。 */
export function coerceThinkingText(raw: string): string {
  return raw.replace(SPINNER_PREFIX_RE, '').trim()
}

/** `error` 事件的 payload。 */
export interface ErrorPayload {
  message?: string
}

/** 网关回放的历史消息（来自 session.create / session.resume）。 */
export interface GatewayMessage {
  role: 'user' | 'assistant' | 'tool' | 'system'
  text?: string
}

/**
 * 历史消息原始行（来自 REST `GET /api/sessions/{id}/messages`，即 db 原始记录）。
 * 与 GatewayMessage 不同，这里保留了 reasoning 字段，用于恢复历史思考过程。
 */
export interface StoredMessage {
  role: 'user' | 'assistant' | 'tool' | 'system'
  /** db 原始 content，可能是字符串或结构化数组（多模态）。 */
  content?: string | unknown[]
  text?: string
  /** 思考内容（不同 provider 字段名不同）。 */
  reasoning?: string
  reasoning_content?: string
  reasoning_details?: unknown
  /** assistant 消息上的原始工具调用列表。 */
  tool_calls?: unknown[]
  /** tool 消息关联的工具调用 id。 */
  tool_call_id?: string
  /** tool 消息携带的工具名。 */
  tool_name?: string
  name?: string
  context?: string
}

/** REST `GET /api/sessions/{id}/messages` 的返回结构。 */
export interface SessionMessagesResult {
  session_id: string
  messages: StoredMessage[]
}

/** `session.create` RPC 的返回结构（只列我们用到的字段）。 */
export interface SessionCreateResult {
  session_id: string
  stored_session_id?: string
  message_count?: number
  messages?: GatewayMessage[]
}

/** `session.resume` RPC 的返回结构。 */
export interface SessionResumeResult {
  session_id: string
  resumed?: boolean
  message_count?: number
  messages?: GatewayMessage[]
}

/** 会话列表里的单条摘要（来自 session.list）。 */
export interface SessionSummary {
  id: string
  title: string
  preview: string
  started_at: number
  message_count: number
  source: string
}

/** `session.list` RPC 的返回结构。 */
export interface SessionListResult {
  sessions: SessionSummary[]
}

/** `prompt.submit` RPC 的返回结构。 */
export interface PromptSubmitResult {
  status: 'streaming' | string
}

/** 模型列表里的单个 provider（来自 model.options）。 */
export interface ModelOptionProvider {
  slug: string
  name: string
  is_current: boolean
  is_user_defined?: boolean
  models: string[]
  total_models: number
  source: string
  authenticated?: boolean
  auth_type?: string
  key_env?: string
  warning?: string
}

/** `model.options` RPC 的返回结构。 */
export interface ModelOptionsResult {
  providers: ModelOptionProvider[]
  /** 当前模型，如 "anthropic/claude-sonnet-4.6" */
  model: string
  /** 当前 provider slug，如 "anthropic" */
  provider: string
}

/** `config.get` key="reasoning" 的返回结构。 */
export interface ReasoningConfigResult {
  value: string // "none"|"minimal"|"low"|"medium"|"high"|"xhigh"
}

/** 思考强度档位映射。 */
export const REASONING_LEVELS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const

export type ReasoningLevel = (typeof REASONING_LEVELS)[number]

/** 思考强度显示标签映射。 */
export const REASONING_LABELS: Record<ReasoningLevel, string> = {
  none: '关闭',
  minimal: '极简',
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '最高'
}
