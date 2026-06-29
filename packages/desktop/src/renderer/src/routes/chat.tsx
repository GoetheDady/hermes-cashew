import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '@hermes/shared'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useGateway } from '@/hooks/use-gateway'
import { useConversation } from '@/hooks/use-conversation'
import { useIdleNotify } from '@/hooks/use-idle-notify'
import { useMidnightHour } from '@/hooks/use-midnight-hour'
import { useSessions } from '@/hooks/use-sessions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from '@/components/message-bubble'
import { CashewPresenceIndicator } from '@/components/cashew-presence-indicator'
import { EmptyConversation } from '@/components/empty-conversation'
import { SessionSidebar } from '@/components/session-sidebar'
import { getCashewPresence, hasActiveToolCall } from '@/lib/cashew-presence'
import {
  canUseSessionHistoryHoverTrigger,
  getSessionHistoryClickSurface,
  SESSION_HISTORY_DRAWER_CLOSE_DELAY_MS,
  SESSION_HISTORY_DRAWER_OPEN_DELAY_MS,
  SESSION_HISTORY_HOVER_TRIGGER_CLASS
} from '@/lib/session-history-layout'
import { shouldShowContinueLast as shouldShowContinueLastFn } from '@/lib/fresh-conversation'
import { getTopControlsRowClass, getTrafficLightInsetPx } from '@/lib/window-chrome'
import { PanelLeftClose, PanelLeftOpen, RotateCcw, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/** 后端 HTTP 基址，用于连接异常时做最薄的可达性分类。 */
const BACKEND_HTTP = 'http://localhost:8765'

/** 本地后端健康检查状态。 */
type BackendHealth = 'idle' | 'checking' | 'available' | 'unavailable'

/** 临时 Session History Drawer 的打开来源。 */
type SessionHistoryDrawerMode = 'click' | 'hover'

/** 用户从哪种 Session History 表面选择会话。 */
type SessionHistorySelectionSource = 'sidebar' | 'drawer' | 'session-history-start'

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
const SESSION_HISTORY_OPEN_KEY = 'hermes-cashew:session-history-open'

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
 * 聊天页面：默认即 Fresh Conversation，直接打字即开新对话（首条消息时才建会话）。
 *
 * 空态在存在历史时多出一个「继续上次」按钮；更早的会话通过“会话历史”按钮展开历史侧栏。
 *
 * @returns 聊天页 React 元素
 */
export function Chat(): React.JSX.Element {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [hasActiveSession, setHasActiveSession] = useState(false)
  const [backendHealth, setBackendHealth] = useState<BackendHealth>('idle')
  const [isInputFocused, setIsInputFocused] = useState(false)
  const isMidnight = useMidnightHour()
  const [initialHistoryCount, setInitialHistoryCount] = useState(0)
  const [isSessionHistoryOpen, setIsSessionHistoryOpen] = useState(() => readSessionHistoryOpenPreference())
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const [drawerMode, setDrawerMode] = useState<SessionHistoryDrawerMode | null>(null)
  const [hasSidebarBeenManuallyClosed, setHasSidebarBeenManuallyClosed] = useState(false)
  const reducedMotion = useReducedMotion()

  /** 共享的运行时 session_id ref：当前页面创建，useConversation 读取。 */
  const sessionIdRef = useRef<string>('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesLengthRef = useRef(0)
  const drawerOpenTimerRef = useRef<number | null>(null)
  const drawerCloseTimerRef = useRef<number | null>(null)

  // ── 业务 hooks ──
  const { clientRef, conn, ready, error: gatewayError, reconnect, clearError } = useGateway()
  const {
    sessions,
    sessionsTotal,
    hasMoreSessions,
    isLoadingMore,
    hasLoadedSessions,
    activeStoredId,
    isSessionLoading,
    excludeCron,
    ensureSession,
    resetActiveSession,
    selectSession,
    refreshSessions,
    loadMoreSessions,
    toggleExcludeCron,
    finishSessionLoading
  } = useSessions(clientRef, sessionIdRef)
  /**
   * 懒创建包装：首条消息发送时调用 ensureSession() 按需建会话，
   * 成功后标记已进入活动会话态，使空态的「继续上次」按钮随后隐藏。
   *
   * @returns 会话就绪后 resolve；create 失败则 reject，由 sendMessage 回滚
   */
  const ensureSessionForSend = useCallback((): Promise<void> => {
    return ensureSession().then(() => {
      setHasActiveSession(true)
    })
  }, [ensureSession])
  const conversation = useConversation(clientRef, sessionIdRef, ready, ensureSessionForSend)

  const {
    messages,
    isStreaming,
    thinkingStartedAt,
    sendMessage,
    setMessages,
    sendError: conversationError,
    clearSendError
  } = conversation

  const clickSurface = getSessionHistoryClickSurface(viewportWidth)
  const isSessionHistorySidebarOpen = isSessionHistoryOpen && clickSurface === 'sidebar'
  const isPersistentSessionHistoryDrawerOpen = isSessionHistoryOpen && clickSurface === 'drawer'
  const isSessionHistoryDrawerOpen = drawerMode !== null || isPersistentSessionHistoryDrawerOpen
  const isSessionHistoryVisible = isSessionHistorySidebarOpen || isSessionHistoryDrawerOpen
  const canShowHoverTrigger =
    !isSessionHistoryDrawerOpen &&
    canUseSessionHistoryHoverTrigger({
      viewportWidth,
      hasSidebarBeenManuallyClosed,
      isSidebarOpen: isSessionHistorySidebarOpen
    })

  // 空闲通知调度：用户停止对话后，随机延迟后弹出系统通知
  useIdleNotify({ messages, isStreaming, ready })

  const activeToolCall = hasActiveToolCall(messages)
  const presence = getCashewPresence({
    conn,
    ready,
    isSessionLoading: isSessionLoading,
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

  /** 侧栏「新对话」：重置回 Fresh Conversation 空态，不调用后端（见 ADR-0001）。 */
  const resetToEmpty = useCallback((): void => {
    if (!ready) return
    setSessionError(null)
    clearCombinedError()
    resetActiveSession()
    setMessages([])
    setInitialHistoryCount(0)
    setHasActiveSession(false)
    setSessionHistoryOpenPreference(setIsSessionHistoryOpen, false)
    setDrawerMode(null)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [ready, clearCombinedError, resetActiveSession, setMessages])

  const continueSession = useCallback(
    (storedId: string, source: SessionHistorySelectionSource = 'session-history-start'): void => {
      if (!ready) return
      setSessionError(null)
      clearCombinedError()
      selectSession(storedId)
        .then((historyMessages) => {
          if (!historyMessages) return
          setInitialHistoryCount(historyMessages.length)
          setMessages(historyMessages)
          setHasActiveSession(true)
          if (source === 'sidebar') {
            setDrawerMode(null)
          } else {
            setSessionHistoryOpenPreference(setIsSessionHistoryOpen, false)
            setDrawerMode(null)
          }
          window.setTimeout(() => inputRef.current?.focus(), 0)
        })
        .catch((e: Error) => {
          finishSessionLoading()
          setSessionError(`恢复会话失败：${e.message}`)
        })
    },
    [ready, clearCombinedError, selectSession, finishSessionLoading, setMessages]
  )

  // ── 初始化：ready 后先查看 Session History；没有历史时才自动创建新对话。 ──
  // ── 初始化：ready 后拉取 Session History，用于「继续上次」按钮。空态即默认，不再自动建会话（见 ADR-0001）。 ──
  useEffect(() => {
    if (ready) refreshSessions()
  }, [ready, refreshSessions])

  // ── 响应式布局：根据窗口宽度在 Sidebar 和 Drawer 之间切换。 ──
  useEffect(() => {
    const updateViewportWidth = (): void => setViewportWidth(window.innerWidth)
    updateViewportWidth()
    window.addEventListener('resize', updateViewportWidth)
    return () => window.removeEventListener('resize', updateViewportWidth)
  }, [])

  // ── Drawer 定时器清理：避免页面卸载后 hover 延迟回调继续 setState。 ──
  useEffect(() => {
    return () => {
      clearSessionHistoryDrawerTimers(drawerOpenTimerRef, drawerCloseTimerRef)
    }
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
  const canSend = ready && !isSessionLoading && !isStreaming && input.trim() !== ''
  const connectionText =
    hasConnectionProblem && backendHealth === 'unavailable'
      ? '本地 Hermes 后端不可用，请确认后端已启动'
      : hasConnectionProblem
        ? '连接已断开'
        : null
  const statusText = sessionError ?? gatewayError ?? conversationError ?? connectionText
  const placeholder = !ready ? '正在连接 Hermes…' : '问 Hermes 点什么…'
  const idleBreathingDuration = isMidnight ? 6 : 4
  const latestSession = sessions[0]
  const topControlsRowClass = getTopControlsRowClass()
  const trafficLightInsetPx = getTrafficLightInsetPx()
  const shouldShowContinueLast = shouldShowContinueLastFn({
    ready,
    hasActiveSession,
    isSessionLoading,
    hasLoadedSessions,
    sessionsCount: sessions.length
  })

  const handleSessionHistoryToggle = useCallback((): void => {
    if (clickSurface === 'drawer') {
      const shouldOpenDrawer = !isSessionHistoryDrawerOpen
      setDrawerMode(shouldOpenDrawer ? 'click' : null)
      if (isSessionHistoryOpen) setSessionHistoryOpenPreference(setIsSessionHistoryOpen, false)
      return
    }

    setDrawerMode(null)
    setSessionHistoryOpenPreference(setIsSessionHistoryOpen, !isSessionHistoryOpen)
    setHasSidebarBeenManuallyClosed(isSessionHistoryOpen)
  }, [clickSurface, isSessionHistoryOpen, isSessionHistoryDrawerOpen])

  const scheduleHoverDrawerOpen = useCallback((): void => {
    if (!canShowHoverTrigger) return
    clearSessionHistoryDrawerTimers(drawerOpenTimerRef, drawerCloseTimerRef)
    drawerOpenTimerRef.current = window.setTimeout(() => {
      setDrawerMode('hover')
    }, SESSION_HISTORY_DRAWER_OPEN_DELAY_MS)
  }, [canShowHoverTrigger])

  const keepHoverDrawerOpen = useCallback((): void => {
    if (drawerCloseTimerRef.current !== null) {
      window.clearTimeout(drawerCloseTimerRef.current)
      drawerCloseTimerRef.current = null
    }
  }, [])

  const scheduleHoverDrawerClose = useCallback((): void => {
    if (drawerMode !== 'hover') return
    if (drawerOpenTimerRef.current !== null) {
      window.clearTimeout(drawerOpenTimerRef.current)
      drawerOpenTimerRef.current = null
    }
    drawerCloseTimerRef.current = window.setTimeout(() => {
      setDrawerMode(null)
    }, SESSION_HISTORY_DRAWER_CLOSE_DELAY_MS)
  }, [drawerMode])

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
      className={`time-atmosphere relative flex min-h-0 min-w-0 flex-1 bg-background text-foreground${isMidnight ? ' midnight-atmosphere' : ''}`}
    >
      <div className={topControlsRowClass} style={{ left: trafficLightInsetPx }}>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="app-no-drag h-7 px-2 text-muted-foreground hover:text-foreground"
            onClick={handleSessionHistoryToggle}
            aria-pressed={isSessionHistoryVisible}
            aria-label="会话历史"
            title={isSessionHistoryVisible ? '收起会话历史' : '展开会话历史'}
          >
            {isSessionHistoryVisible ? (
              <PanelLeftClose className="size-3.5" />
            ) : (
              <PanelLeftOpen className="size-3.5" />
            )}
          </Button>
          <CashewPresenceIndicator presence={presence} reducedMotion={reducedMotion} />
        </div>
        {!isSessionHistoryVisible && (
          <Button
            variant="ghost"
            size="sm"
            className="app-no-drag h-7 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/settings')}
            title="设置"
          >
            <Settings className="size-3.5" />
          </Button>
        )}
      </div>
      {canShowHoverTrigger && (
        <div
          className={`app-no-drag absolute inset-y-0 left-0 z-30 ${SESSION_HISTORY_HOVER_TRIGGER_CLASS}`}
          onMouseEnter={scheduleHoverDrawerOpen}
          aria-hidden="true"
        />
      )}
      <AnimatePresence initial={false}>
        {isSessionHistorySidebarOpen && (
          <motion.div
            key="session-history-sidebar"
            className="h-full min-h-0 shrink-0 overflow-hidden"
            initial={reducedMotion ? { width: '18rem', opacity: 1 } : { width: 0, opacity: 0.4 }}
            animate={{ width: '18rem', opacity: 1 }}
            exit={reducedMotion ? { width: 0, opacity: 0 } : { width: 0, opacity: 0.4 }}
            transition={reducedMotion ? { duration: 0 } : softTransition}
          >
            {/* 只动画外层宽度，让侧栏内部维持固定排版，避免文字在收起过程中重排。 */}
            <SessionSidebar
              sessions={sessions}
              sessionsTotal={sessionsTotal}
              hasMoreSessions={hasMoreSessions}
              isLoadingMore={isLoadingMore}
              activeStoredId={activeStoredId}
              ready={ready}
              isStreaming={isStreaming}
              isSessionLoading={isSessionLoading}
              conn={conn}
              excludeCron={excludeCron}
              onNewSession={resetToEmpty}
              onSelectSession={(storedId) => continueSession(storedId, 'sidebar')}
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
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {isSessionHistoryDrawerOpen && (
          <motion.div
            key="session-history-drawer"
            className="absolute inset-y-0 left-0 z-40 h-full w-72 overflow-hidden shadow-[12px_0_32px_color-mix(in_oklch,var(--foreground)_10%,transparent)]"
            initial={reducedMotion ? { x: 0, opacity: 1 } : { x: -288, opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reducedMotion ? { x: -288, opacity: 0 } : { x: -288, opacity: 0.5 }}
            transition={reducedMotion ? { duration: 0 } : softTransition}
            onMouseEnter={keepHoverDrawerOpen}
            onMouseLeave={scheduleHoverDrawerClose}
          >
            <SessionSidebar
              sessions={sessions}
              sessionsTotal={sessionsTotal}
              hasMoreSessions={hasMoreSessions}
              isLoadingMore={isLoadingMore}
              activeStoredId={activeStoredId}
              ready={ready}
              isStreaming={isStreaming}
              isSessionLoading={isSessionLoading}
              conn={conn}
              excludeCron={excludeCron}
              onNewSession={resetToEmpty}
              onSelectSession={(storedId) => continueSession(storedId, 'drawer')}
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
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pt-9">
        <div className="app-no-drag relative min-h-0 flex-1 px-3">
          <ScrollArea className="h-full">
            <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-4">
              {messages.length === 0 ? (
                <EmptyConversation
                  ready={ready}
                  onContinueLast={
                    shouldShowContinueLast && latestSession
                      ? () => continueSession(latestSession.id, 'session-history-start')
                      : undefined
                  }
                  continueLastDisabled={!ready || isSessionLoading}
                />
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
                  onClick={() => setSessionError(null)}
                >
                  <RotateCcw className="size-3" />
                  重试
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
                disabled={!ready || isSessionLoading}
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
 * 读取用户上次是否展开了 Session History。
 *
 * @returns 本地偏好存在且为 true 时返回 true
 */
function readSessionHistoryOpenPreference(): boolean {
  const stored = window.localStorage.getItem(SESSION_HISTORY_OPEN_KEY)
  if (stored !== null) return stored === 'true'
  // 一次性兼容迁移：旧 key 'hermes-cashew:memory-open' → SESSION_HISTORY_OPEN_KEY
  const legacy = window.localStorage.getItem('hermes-cashew:memory-open')
  if (legacy !== null) {
    window.localStorage.setItem(SESSION_HISTORY_OPEN_KEY, legacy)
    window.localStorage.removeItem('hermes-cashew:memory-open')
    return legacy === 'true'
  }
  return false
}

/**
 * 显式设置 Session History 显隐，并同步本地 UI 偏好。
 *
 * @param setOpen - React state setter
 * @param next - 是否展开 Session History
 * @returns 无返回值
 */
function setSessionHistoryOpenPreference(
  setOpen: React.Dispatch<React.SetStateAction<boolean>>,
  next: boolean
): void {
  window.localStorage.setItem(SESSION_HISTORY_OPEN_KEY, String(next))
  setOpen(next)
}

/**
 * 清理 Session History Drawer 的 hover 打开/关闭延迟定时器。
 *
 * @param openTimerRef - hover 打开延迟定时器 ref
 * @param closeTimerRef - hover 关闭延迟定时器 ref
 * @returns 无返回值
 */
function clearSessionHistoryDrawerTimers(
  openTimerRef: React.MutableRefObject<number | null>,
  closeTimerRef: React.MutableRefObject<number | null>
): void {
  if (openTimerRef.current !== null) {
    window.clearTimeout(openTimerRef.current)
    openTimerRef.current = null
  }
  if (closeTimerRef.current !== null) {
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }
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
