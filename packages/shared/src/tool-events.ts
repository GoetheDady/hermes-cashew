/**
 * 工具事件 —— payload 类型、upsert 逻辑与内部辅助函数。
 */

import type { ChatMessagePart, ToolCallPart } from './message.js'
import { toolCallPart } from './message.js'

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
 * 判断未知值是否为普通对象。
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

/**
 * 读取工具事件里的调用 id。
 */
function toolEventId(payload: ToolEventPayload | undefined): string {
  if (!payload || !('tool_id' in payload) || typeof payload.tool_id !== 'string') return ''
  return payload.tool_id
}

/**
 * 读取工具事件里的工具名。
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
 */
export function parseArgsObject(value: unknown): Record<string, unknown> {
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
 */
export function firstStringField(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return ''
}
