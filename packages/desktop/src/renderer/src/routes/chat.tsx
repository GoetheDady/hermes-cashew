import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage, GatewayMessage, SessionCreateResult } from '@hermes/shared'
import { textPart } from '@hermes/shared'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useGateway } from '@/hooks/use-gateway'
import { useConversation } from '@/hooks/use-conversation'
import { useIdleNotify } from '@/hooks/use-idle-notify'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from '@/components/message-bubble'
import { EmptyConversation } from '@/components/empty-conversation'
import { RotateCcw } from 'lucide-react'

/** 后端 HTTP 基址，用于连接异常时做最薄的可达性分类。 */
const BACKEND_HTTP = 'http://localhost:8765'

/** 本地后端健康检查状态。 */
type BackendHealth = 'idle' | 'checking' | 'available' | 'unavailable'

/** 页面级微动效参数：短、轻、低位移。 */
const softTransition = { duration: 0.22, ease: 'easeOut' } as const

const idleInputShadow = '0 6px 18px color-mix(in oklch, var(--foreground) 7%, transparent), 0 1px 2px color-mix(in oklch, var(--foreground) 8%, transparent)'
const focusedInputShadow = [
  '0 0 0 1px color-mix(in oklch, var(--ring) 10%, transparent), 0 12px 30px color-mix(in oklch, var(--foreground) 9%, transparent), 0 0 22px color-mix(in oklch, var(--primary) 9%, transparent)',
  '0 0 0 1px color-mix(in oklch, var(--ring) 14%, transparent), 0 18px 46px color-mix(in oklch, var(--foreground) 13%, transparent), 0 0 36px color-mix(in oklch, var(--primary) 15%, transparent)',
  '0 0 0 1px color-mix(in oklch, var(--ring) 10%, transparent), 0 12px 30px color-mix(in oklch, var(--foreground) 9%, transparent), 0 0 22px color-mix(in oklch, var(--primary) 9%, transparent)'
]

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
  const [backendHealth, setBackendHealth] = useState<BackendHealth>('idle')
  const [isInputFocused, setIsInputFocused] = useState(false)
  const reducedMotion = useReducedMotion()

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

  // 空闲通知调度：用户停止对话后，随机延迟后弹出系统通知
  useIdleNotify({ messages, isStreaming, ready })

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
      .request<SessionCreateResult>('session.create', {
        source: 'hermes-cashew',
        instructions: '你运行在 hermes-cashew 中，这是一个腰果色温主题的桌面 AI 助手。'
      })
      .then((res) => {
        sessionIdRef.current = res.session_id
        const initialMessages = mapHistory(res.messages)
        // Gateway Reconnect 后会创建新的运行时会话；若 dashboard 没返回可见消息，
        // 不清空用户已经看到的 transcript，避免一次恢复动作看起来像丢上下文。
        setMessages((prev) =>
          prev.length === 0 || initialMessages.length > 0 ? initialMessages : prev
        )
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

  const hasConnectionProblem = conn === 'closed' || conn === 'error'
  const canSend = ready && hasActiveSession && !isSessionStarting && !isStreaming && input.trim() !== ''
  const connectionText =
    hasConnectionProblem && backendHealth === 'unavailable'
      ? '本地 Hermes 后端不可用，请确认后端已启动'
      : hasConnectionProblem
        ? '连接已断开'
        : null
  const statusText = sessionError ?? gatewayError ?? conversationError ?? connectionText
  const placeholder = !ready
    ? '正在连接 Hermes…'
    : isSessionStarting
      ? '正在开启新对话…'
      : '问 Hermes 点什么…'

  // 只在连接异常时探测后端健康；健康状态是文案分类，不参与 token 或 dashboard 细节。
  useEffect(() => {
    if (!hasConnectionProblem) {
      setBackendHealth('idle')
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 1500)
    setBackendHealth('checking')

    checkBackendHealth(controller.signal)
      .then((available) => setBackendHealth(available ? 'available' : 'unavailable'))
      .catch(() => setBackendHealth('unavailable'))
      .finally(() => window.clearTimeout(timer))

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [hasConnectionProblem])

  // ── 发送消息 ──
  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!canSend) return
    clearCombinedError()
    sendMessage(text)
      .then(() => setInput(''))
      .catch(() => {
        inputRef.current?.focus()
      })
  }, [input, canSend, sendMessage, clearCombinedError])

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

      <AnimatePresence initial={false}>
        {statusText && (
          <motion.div
            className="mx-auto mb-2 flex w-full max-w-3xl items-center justify-between gap-3 px-4 text-xs"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            transition={softTransition}
          >
            <span className="min-w-0 break-words text-destructive">{statusText}</span>
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
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="p-3">
        <div className="mx-auto max-w-3xl">
          <motion.div
            className="rounded-xl border bg-card px-3 pb-2.5 pt-2.5 shadow-sm"
            animate={
              reducedMotion
                ? undefined
                : {
                    boxShadow: isInputFocused ? focusedInputShadow : idleInputShadow
                  }
            }
            transition={
              isInputFocused && !reducedMotion
                ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                : softTransition
            }
          >
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
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
          </motion.div>
        </div>
      </footer>
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

/**
 * 检查本地后端是否能响应健康检查。
 *
 * @param signal - 取消请求的 AbortSignal
 * @returns 后端 `/api/health` 是否可用
 */
async function checkBackendHealth(signal: AbortSignal): Promise<boolean> {
  const res = await fetch(`${BACKEND_HTTP}/api/health`, { signal })
  return res.ok
}
