/**
 * ChatMessage —— 消息渲染模型（types + helpers）。
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
