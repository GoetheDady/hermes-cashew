import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '@hermes/shared'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useGateway } from '@/hooks/use-gateway'
import { useConversation } from '@/hooks/use-conversation'
import { useIdleNotify } from '@/hooks/use-idle-notify'
import { useSessions } from '@/hooks/use-sessions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from '@/components/message-bubble'
import { EmptyConversation } from '@/components/empty-conversation'
import { SessionSidebar } from '@/components/session-sidebar'
import type { CashewPresenceState } from '@/lib/cashew-presence'
import { getCashewPresence, hasActiveToolCall } from '@/lib/cashew-presence'
import { History, PanelLeftClose, RotateCcw, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/** 后端 HTTP 基址，用于连接异常时做最薄的可达性分类。 */
const BACKEND_HTTP = 'http://localhost:8765'

/** 本地后端健康检查状态。 */
type BackendHealth = 'idle' | 'checking' | 'available' | 'unavailable'

/** 页面级微动效参数：短、轻、低位移。 */
const softTransition = { duration: 0.22, ease: 'easeOut' } as const

const idleInputShadow = [
  '0 6px 18px color-mix(in oklch, var(--foreground) 3%, transparent), 0 1px 2px color-mix(in oklch, var(--foreground) 4%, transparent)',
  '0 8px 24px color-mix(in oklch, var(--foreground) 8%, transparent), 0 1px 4px color-mix(in oklch, var(--foreground) 6%, transparent)',
  '0 6px 18px color-mix(in oklch, var(--foreground) 3%, transparent), 0 1px 2px color-mix(in oklch, var(--foreground) 4%, transparent)'
]
const focusedInputShadow = [
  '0 0 0 1px color-mix(in oklch, var(--ring) 10%, transparent), 0 12px 30px color-mix(in oklch, var(--foreground) 9%, transparent), 0 0 22px color-mix(in oklch, var(--primary) 9%, transparent)',
  '0 0 0 1px color-mix(in oklch, var(--ring) 14%, transparent), 0 18px 46px color-mix(in oklch, var(--foreground) 13%, transparent), 0 0 36px color-mix(in oklch, var(--primary) 15%, transparent)',
  '0 0 0 1px color-mix(in oklch, var(--ring) 10%, transparent), 0 12px 30px color-mix(in oklch, var(--foreground) 9%, transparent), 0 0 22px color-mix(in oklch, var(--primary) 9%, transparent)'
]

const MIN_MESSAGE_ENTRY_DELAY = 0.08
const MAX_MESSAGE_ENTRY_DELAY = 0.2
const MEMORY_OPEN_KEY = 'hermes-cashew:memory-open'

/**
 * 当前本地时间是否处于午夜氛围时段。
 *
 * @returns 0-5 点返回 true，其余时间返回 false
 */
function isMidnightHour(): boolean {
  const hour = new Date().getHours()
  return hour >= 0 && hour <= 5
}

/**
 * 为消息 key 生成稳定的错落入场延迟。
 *
 * @param key - 消息身份和索引组成的稳定 key
 * @returns 80ms 到 200ms 之间的秒数，用于 Motion transition
 */
function createMessageEntryDelay(key: string): number {
  let hash = 0
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 1000
  }
  return (
    MIN_MESSAGE_ENTRY_DELAY + (hash / 999) * (MAX_MESSAGE_ENTRY_DELAY - MIN_MESSAGE_ENTRY_DELAY)
  )
}

/**
 * 生成用于动画判断的消息 key。
 *
 * @param message - 当前渲染的消息
 * @param index - 消息在 transcript 中的索引
 * @returns 稳定标识，同一条 mounted 消息重渲染时保持不变
 */
function getMessageAnimationKey(message: ChatMessage, index: number): string {
  return `${message.id ?? message.role}:${index}`
}

/**
 * 聊天页面：先给出轻量记忆入口，再进入 Hermes 对话。
 *
 * Session History 默认不占据主表面；用户可以继续最近会话、开启新会话，
 * 或通过“记忆”按钮临时展开历史侧栏。
 *
 * @returns 聊天页 React 元素
 */
export function Chat(): React.JSX.Element {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [isSessionStarting, setIsSessionStarting] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [hasActiveSession, setHasActiveSession] = useState(false)
  const [sessionRetryKey, setSessionRetryKey] = useState(0)
  const [backendHealth, setBackendHealth] = useState<BackendHealth>('idle')
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [isMidnight, setIsMidnight] = useState(() => isMidnightHour())
  const [initialHistoryCount, setInitialHistoryCount] = useState(0)
  const [isMemoryOpen, setIsMemoryOpen] = useState(() => readMemoryOpenPreference())
  const reducedMotion = useReducedMotion()

  /** 共享的运行时 session_id ref：当前页面创建，useConversation 读取。 */
  const sessionIdRef = useRef<string>('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesLengthRef = useRef(0)

  // ── 业务 hooks ──
  const { clientRef, conn, ready, error: gatewayError, reconnect, clearError } = useGateway()
  const conversation = useConversation(clientRef, sessionIdRef, ready)
  const {
    sessions,
    sessionsTotal,
    hasMoreSessions,
    isLoadingMore,
    hasLoadedSessions,
    activeStoredId,
    isSessionLoading,
    excludeCron,
    newSession,
    selectSession,
    refreshSessions,
    loadMoreSessions,
    toggleExcludeCron,
    finishSessionLoading
  } = useSessions(clientRef, sessionIdRef)

  const {
    messages,
    isStreaming,
    thinkingStartedAt,
    sendMessage,
    setMessages,
    sendError: conversationError,
    clearSendError
  } = conversation

  // 空闲通知调度：用户停止对话后，随机延迟后弹出系统通知
  useIdleNotify({ messages, isStreaming, ready })

  const activeToolCall = hasActiveToolCall(messages)
  const presence = getCashewPresence({
    conn,
    ready,
    isSessionLoading: isSessionStarting || isSessionLoading,
    hasActiveSession,
    isStreaming,
    hasActiveToolCall: activeToolCall,
    isIdle: messages.length > 0 && !isStreaming,
    isMidnight
  })

  const clearCombinedError = useCallback(() => {
    clearError()
    clearSendError()
    setSessionError(null)
  }, [clearError, clearSendError])

  const startNewSession = useCallback((): void => {
    if (!ready || isSessionStarting) return
    setIsSessionStarting(true)
    setSessionError(null)
    clearCombinedError()
    newSession()
      .then((initialMessages) => {
        setInitialHistoryCount(initialMessages.length)
        setMessages(initialMessages)
        setHasActiveSession(true)
        setMemoryOpenPreference(setIsMemoryOpen, false)
        window.setTimeout(() => inputRef.current?.focus(), 0)
      })
      .catch((e: Error) => {
        setHasActiveSession(false)
        setSessionError(`新建对话失败：${e.message}`)
      })
      .finally(() => setIsSessionStarting(false))
  }, [ready, isSessionStarting, clearCombinedError, newSession, setMessages])

  const continueSession = useCallback(
    (storedId: string): void => {
      if (!ready || isSessionStarting) return
      setSessionError(null)
      clearCombinedError()
      selectSession(storedId)
        .then((historyMessages) => {
          if (!historyMessages) return
          setInitialHistoryCount(historyMessages.length)
          setMessages(historyMessages)
          setHasActiveSession(true)
          setMemoryOpenPreference(setIsMemoryOpen, false)
          window.setTimeout(() => inputRef.current?.focus(), 0)
        })
        .catch((e: Error) => {
          finishSessionLoading()
          setSessionError(`恢复会话失败：${e.message}`)
        })
    },
    [ready, isSessionStarting, clearCombinedError, selectSession, finishSessionLoading, setMessages]
  )

  // ── 初始化：ready 后先查看 Session History；没有历史时才自动创建新对话。 ──
  useEffect(() => {
    if (ready) refreshSessions()
  }, [ready, refreshSessions])

  useEffect(() => {
    if (!ready || hasActiveSession || isSessionStarting || sessionError) return
    if (!hasLoadedSessions || sessions.length > 0) return
    // 避开 effect 同步 setState；自动创建只需排到当前渲染提交之后。
    const timer = window.setTimeout(startNewSession, 0)
    return () => window.clearTimeout(timer)
  }, [
    ready,
    hasActiveSession,
    isSessionStarting,
    sessionError,
    hasLoadedSessions,
    sessions.length,
    startNewSession,
    sessionRetryKey
  ])

  // ── 午夜氛围：分钟级检查即可，跨 0/6 点时自动切换色温和节奏。 ──
  useEffect(() => {
    const updateMidnight = (): void => setIsMidnight(isMidnightHour())
    updateMidnight()
    const interval = window.setInterval(updateMidnight, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  // ── 镜像消息数量，供 session.create 回调区分历史/回放与后续新消息。 ──
  useEffect(() => {
    messagesLengthRef.current = messages.length
  }, [messages.length])

  // ── 滚动到底部 ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages])

  const hasConnectionProblem = conn === 'closed' || conn === 'error'
  const canSend =
    ready && hasActiveSession && !isSessionStarting && !isStreaming && input.trim() !== ''
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
  const idleBreathingDuration = isMidnight ? 6 : 4
  const latestSession = sessions[0]
  const shouldShowMemoryStart =
    ready &&
    !hasActiveSession &&
    !isSessionStarting &&
    !isSessionLoading &&
    hasLoadedSessions &&
    sessions.length > 0

  // 只在连接异常时探测后端健康；健康状态是文案分类，不参与 token 或 dashboard 细节。
  useEffect(() => {
    if (!hasConnectionProblem) {
      const idleTimer = window.setTimeout(() => setBackendHealth('idle'), 0)
      return () => window.clearTimeout(idleTimer)
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 1500)
    const checkingTimer = window.setTimeout(() => setBackendHealth('checking'), 0)

    checkBackendHealth(controller.signal)
      .then((available) => setBackendHealth(available ? 'available' : 'unavailable'))
      .catch(() => setBackendHealth('unavailable'))
      .finally(() => {
        window.clearTimeout(checkingTimer)
        window.clearTimeout(timer)
      })

    return () => {
      window.clearTimeout(checkingTimer)
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
    <div
      className={`time-atmosphere flex min-h-0 min-w-0 flex-1 bg-background text-foreground${isMidnight ? ' midnight-atmosphere' : ''}`}
    >
      {isMemoryOpen && (
        <SessionSidebar
          sessions={sessions}
          sessionsTotal={sessionsTotal}
          hasMoreSessions={hasMoreSessions}
          isLoadingMore={isLoadingMore}
          activeStoredId={activeStoredId}
          ready={ready}
          isStreaming={isStreaming}
          isSessionLoading={isSessionLoading || isSessionStarting}
          conn={conn}
          excludeCron={excludeCron}
          onNewSession={startNewSession}
          onSelectSession={continueSession}
          onLoadMore={loadMoreSessions}
          onReconnect={reconnect}
          onToggleExcludeCron={toggleExcludeCron}
          footerSlot={
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs"
              onClick={() => navigate('/settings')}
            >
              <Settings className="size-3.5" />
              设置
            </Button>
          }
        />
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="app-no-drag relative z-50 ml-24 flex h-9 shrink-0 items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => toggleMemoryOpen(setIsMemoryOpen)}
              aria-pressed={isMemoryOpen}
            >
              {isMemoryOpen ? (
                <PanelLeftClose className="size-3.5" />
              ) : (
                <History className="size-3.5" />
              )}
              记忆
            </Button>
            <CashewPresenceIndicator presence={presence} reducedMotion={reducedMotion} />
          </div>
          {!isMemoryOpen && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/settings')}
              title="设置"
            >
              <Settings className="size-3.5" />
            </Button>
          )}
        </div>
        <div className="app-no-drag relative min-h-0 flex-1 px-3">
          <ScrollArea className="h-full">
            <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-4">
              {shouldShowMemoryStart && latestSession ? (
                <MemoryStart
                  title={
                    latestSession.title?.trim() || latestSession.preview?.trim() || '最近的会话'
                  }
                  preview={latestSession.preview?.trim() || '继续上一次和 Hermes 的对话'}
                  disabled={!ready || isSessionLoading || isSessionStarting}
                  onContinue={() => continueSession(latestSession.id)}
                  onNew={startNewSession}
                />
              ) : messages.length === 0 ? (
                <EmptyConversation ready={ready} isSessionStarting={isSessionStarting} />
              ) : (
                <div className="space-y-3">
                  {messages.map((m, i) => {
                    const isLast = i === messages.length - 1
                    const isLastStreaming = isLast && isStreaming && m.role === 'assistant'
                    const animateEntry = i >= initialHistoryCount
                    const animationKey = getMessageAnimationKey(m, i)
                    return (
                      <MessageBubble
                        key={m.id ?? i}
                        message={m}
                        isStreaming={isLastStreaming}
                        thinkingStartedAt={isLastStreaming ? thinkingStartedAt : null}
                        animateEntry={animateEntry}
                        entryDelay={animateEntry ? createMessageEntryDelay(animationKey) : 0}
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
              className="app-no-drag mx-auto mb-2 flex w-full max-w-3xl items-center justify-between gap-3 px-4 text-xs"
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

        <footer className="app-no-drag p-3">
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
                  : { duration: idleBreathingDuration, repeat: Infinity, ease: 'easeInOut' }
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
    </div>
  )
}

/**
 * 渲染第一次进入时的最近会话选择。
 *
 * @param props - 最近会话摘要、禁用态和用户动作
 * @returns 继续上次或新建会话的轻量入口
 */
function MemoryStart({
  title,
  preview,
  disabled,
  onContinue,
  onNew
}: {
  title: string
  preview: string
  disabled: boolean
  onContinue: () => void
  onNew: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="w-full max-w-md rounded-xl border border-border/80 bg-card/72 px-4 py-4 shadow-sm">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">最近的记忆</p>
          <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
          <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">{preview}</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onNew} disabled={disabled}>
            新对话
          </Button>
          <Button size="sm" onClick={onContinue} disabled={disabled}>
            继续上次
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * 展示 Cashew Presence 的小型状态胶囊。
 *
 * @param props - presence 状态与 reduced-motion 偏好
 * @returns 顶部状态提示元素
 */
function CashewPresenceIndicator({
  presence,
  reducedMotion
}: {
  presence: CashewPresenceState
  reducedMotion: boolean | null
}): React.JSX.Element {
  const toneClass = {
    warm: 'bg-primary/12 text-foreground',
    muted: 'bg-muted text-muted-foreground',
    active: 'bg-accent/75 text-accent-foreground',
    danger: 'bg-destructive/12 text-destructive'
  }[presence.tone]

  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs ${toneClass}`}
      aria-label={`Cashew Presence: ${presence.label}`}
    >
      <motion.span
        className="size-1.5 rounded-full bg-current"
        animate={
          presence.breathes && !reducedMotion
            ? { opacity: [0.45, 1, 0.45], scale: [1, 1.22, 1] }
            : undefined
        }
        transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      />
      {presence.label}
    </span>
  )
}

/**
 * 读取用户上次是否展开了 Session History。
 *
 * @returns 本地偏好存在且为 true 时返回 true
 */
function readMemoryOpenPreference(): boolean {
  return window.localStorage.getItem(MEMORY_OPEN_KEY) === 'true'
}

/**
 * 切换 Session History 显隐，并同步到本地 UI 偏好。
 *
 * @param setOpen - React state setter
 * @returns 无返回值
 */
function toggleMemoryOpen(setOpen: React.Dispatch<React.SetStateAction<boolean>>): void {
  setOpen((prev) => {
    const next = !prev
    window.localStorage.setItem(MEMORY_OPEN_KEY, String(next))
    return next
  })
}

/**
 * 显式设置 Session History 显隐，并同步本地 UI 偏好。
 *
 * @param setOpen - React state setter
 * @param next - 是否展开 Session History
 * @returns 无返回值
 */
function setMemoryOpenPreference(
  setOpen: React.Dispatch<React.SetStateAction<boolean>>,
  next: boolean
): void {
  window.localStorage.setItem(MEMORY_OPEN_KEY, String(next))
  setOpen(next)
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
