import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ChatMessage,
  ErrorPayload,
  MessageCompletePayload,
  MessageDeltaPayload,
  ThinkingDeltaPayload,
  ToolCompletePayload,
  ToolProgressPayload,
  ToolStartPayload
} from '@hermes/shared'
import {
  appendReasoningPart,
  appendTextPart,
  chatMessageText,
  coerceThinkingText,
  completeAssistantParts,
  textPart,
  upsertToolCallPart
} from '@hermes/shared'
import { GatewayClient } from '@/lib/gateway-client'

export interface UseConversationResult {
  /** 当前对话消息列表。 */
  messages: ChatMessage[]
  /** 是否正在流式接收助手回复。 */
  isStreaming: boolean
  /** 当前回合思考开始时间戳（ms），用于思考块 running timer。 */
  thinkingStartedAt: number | null
  /** 发送消息；Promise resolve 表示网关已接受本次 prompt.submit。 */
  sendMessage: (text: string) => Promise<void>
  /** 直接设置消息列表（用于加载历史 / 新建会话）。 */
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  /** 发送错误消息。 */
  sendError: string | null
  /** 清除发送错误。 */
  clearSendError: () => void
}

/**
 * 管理消息流式接收、发送与事件订阅。
 *
 * 消息事件（delta / thinking / tool / complete / error）在此订阅，
 * 通过 GatewayClient 的事件系统驱动 `messages` 状态的增量更新。
 *
 * @param clientRef - GatewayClient 实例引用
 * @param sessionIdRef - 共享的运行时 session_id ref（由当前页面或 useSessions 写入，此处读取）
 * @param ready - 网关握手是否已完成（未完成时禁止发送）
 * @param onMessageComplete - 每轮消息完成回调（通常用于刷新会话列表）
 */
export function useConversation(
  clientRef: React.RefObject<GatewayClient | null>,
  sessionIdRef: React.MutableRefObject<string>,
  ready: boolean,
  onMessageComplete?: () => void
): UseConversationResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [thinkingStartedAt, setThinkingStartedAt] = useState<number | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  const reasoningRef = useRef<string>('')
  // 用 ref 镜像 isStreaming，供回调解引用同步读取。
  const isStreamingRef = useRef(false)
  useEffect(() => {
    isStreamingRef.current = isStreaming
  }, [isStreaming])

  // 保持回调新鲜度。
  const onMessageCompleteRef = useRef(onMessageComplete)
  useEffect(() => {
    onMessageCompleteRef.current = onMessageComplete
  }, [onMessageComplete])

  const clearSendError = useCallback(() => setSendError(null), [])

  /** 设置事件订阅，仅在 client 实例变更时重新绑定。 */
  useEffect(() => {
    const client = clientRef.current
    if (!client) return

    const offStart = client.on('message.start', () => {
      reasoningRef.current = ''
      setThinkingStartedAt(Date.now())
    })

    const offDelta = client.on<MessageDeltaPayload>('message.delta', (evt) => {
      const text = evt.payload?.text ?? ''
      if (!text) return
      setMessages((prev) => appendTextToLastAssistant(prev, text))
    })

    const offThinking = client.on<ThinkingDeltaPayload>('thinking.delta', (evt) => {
      const raw = evt.payload?.text ?? ''
      const cleaned = coerceThinkingText(raw)
      if (!cleaned) return
      reasoningRef.current += cleaned
      setMessages((prev) => appendReasoningToLastAssistant(prev, cleaned))
    })

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
      onMessageCompleteRef.current?.()
    })

    const offError = client.on<ErrorPayload>('error', (evt) => {
      setSendError(evt.payload?.message ?? '网关返回错误')
      setThinkingStartedAt(null)
      setIsStreaming(false)
    })

    return () => {
      offStart()
      offDelta()
      offThinking()
      offReasoning()
      offToolStart()
      offToolProgress()
      offToolComplete()
      offComplete()
      offError()
    }
  }, [clientRef])

  const sendMessage = useCallback(
    (text: string): Promise<void> => {
      const client = clientRef.current
      if (text === '' || isStreamingRef.current) return Promise.resolve()
      if (!ready || !client) {
        const err = new Error('网关未连接')
        setSendError(`发送失败：${err.message}`)
        return Promise.reject(err)
      }

      setMessages((prev) => [
        ...prev,
        { role: 'user', parts: [textPart(text)] },
        { role: 'assistant', parts: [] }
      ])
      setSendError(null)
      setIsStreaming(true)

      return client
        .request('prompt.submit', { session_id: sessionIdRef.current, text })
        .then(() => undefined)
        .catch((e: Error) => {
          setSendError(`发送失败：${e.message}`)
          setIsStreaming(false)
          setMessages((prev) => dropFailedPromptTurn(prev, text))
          throw e
        })
    },
    [clientRef, ready]
  )

  return {
    messages,
    isStreaming,
    thinkingStartedAt,
    sendMessage,
    setMessages,
    sendError,
    clearSendError
  }
}

// ─── 纯函数：消息 parts 操作（从 App.tsx 搬出） ──────────────────────────

function appendTextToLastAssistant(messages: ChatMessage[], text: string): ChatMessage[] {
  const next = ensureLastAssistant(messages)
  const last = next[next.length - 1]
  if (last?.role === 'assistant') {
    next[next.length - 1] = { ...last, parts: appendTextPart(last.parts, text) }
  }
  return next
}

function appendReasoningToLastAssistant(messages: ChatMessage[], text: string): ChatMessage[] {
  const next = ensureLastAssistant(messages)
  const last = next[next.length - 1]
  if (last?.role === 'assistant') {
    next[next.length - 1] = { ...last, parts: appendReasoningPart(last.parts, text) }
  }
  return next
}

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

function ensureLastAssistant(messages: ChatMessage[]): ChatMessage[] {
  const last = messages[messages.length - 1]
  if (last?.role === 'assistant') return [...messages]
  return [...messages, { role: 'assistant', parts: [] }]
}

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

function dropEmptyAssistantParts(messages: ChatMessage[]): ChatMessage[] {
  const last = messages[messages.length - 1]
  if (last?.role !== 'assistant') return messages
  const text = chatMessageText(last)
  const hasReasoning = last.parts.some((p) => p.type === 'reasoning')
  const hasToolCall = last.parts.some((p) => p.type === 'tool-call')
  return text === '' && !hasReasoning && !hasToolCall ? messages.slice(0, -1) : messages
}

/**
 * 回滚一次未被网关接受的乐观 prompt turn。
 *
 * @param messages - 当前对话消息列表
 * @param text - 本次尝试发送的用户文本
 * @returns 若最后一轮仍是空 assistant，则移除该失败 turn；否则保留已有流式内容
 */
function dropFailedPromptTurn(messages: ChatMessage[], text: string): ChatMessage[] {
  const withoutEmptyAssistant = dropEmptyAssistantParts(messages)
  const last = withoutEmptyAssistant[withoutEmptyAssistant.length - 1]
  if (last?.role !== 'user' || chatMessageText(last) !== text) return withoutEmptyAssistant
  return withoutEmptyAssistant.slice(0, -1)
}
