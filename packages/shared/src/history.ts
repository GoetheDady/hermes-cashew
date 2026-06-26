/**
 * 历史消息处理 —— 将 db 原始记录 / 网关回放映射为渲染用 ChatMessage。
 */

import type { StoredMessage } from './gateway.js'
import type { ChatMessage, ChatMessagePart, ToolCallPart } from './message.js'
import { reasoningPart, textPart, toolCallPart } from './message.js'
import { firstStringField, isRecord, parseArgsObject } from './tool-events.js'

/**
 * 用回合完成事件的完整文本更新 assistant parts，同时保留工具调用相对位置。
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
 * 从 assistant 原始 tool_calls 字段生成工具调用片段。
 */
function storedToolCallsToParts(toolCalls: unknown[] | undefined): ToolCallPart[] {
  if (!Array.isArray(toolCalls)) return []

  return toolCalls
    .map((call, index) => storedToolCallToPart(call, index))
    .filter((part): part is ToolCallPart => part !== null)
}

/**
 * 从单个原始 tool_call 对象生成工具调用片段。
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
