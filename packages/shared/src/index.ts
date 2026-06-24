/**
 * @hermes/shared —— 前端、后端共用的 Hermes 网关协议类型。
 *
 * Hermes dashboard 通过 `/api/ws` 暴露 JSON-RPC 2.0 over WebSocket 网关。
 * 这里定义客户端与桥接后端共用的帧、事件与方法返回结构。
 * 协议来源：Hermes 的 tui_gateway/server.py 与 apps/shared/src/json-rpc-gateway.ts。
 */

/** 一条对话消息（渲染层内存历史用）。 */
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** 网关推送的事件类型（已知集合 + 兜底字符串）。 */
export type GatewayEventName =
  | 'gateway.ready'
  | 'session.info'
  | 'message.start'
  | 'message.delta'
  | 'message.complete'
  | 'thinking.delta'
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
  status?: 'complete' | 'interrupted' | 'error'
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
