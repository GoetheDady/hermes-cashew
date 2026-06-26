/**
 * 网关协议 —— 事件类型、RPC 帧、会话/模型/配置相关类型。
 */

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

/** 分页会话列表的返回结构（来自本地 REST `/api/sessions`）。 */
export interface PaginatedSessionListResult {
  sessions: SessionSummary[]
  total: number
  offset: number
  limit: number
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
