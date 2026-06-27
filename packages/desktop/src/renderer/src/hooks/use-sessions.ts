import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ChatMessage,
  PaginatedSessionListResult,
  SessionCreateResult,
  SessionMessagesResult,
  SessionResumeResult,
  SessionSummary
} from '@hermes/shared'
import { storedMessagesToChatMessages, type GatewayMessage } from '@hermes/shared'
import { textPart } from '@hermes/shared'
import { GatewayClient } from '@/lib/gateway-client'

/** 后端 HTTP 基址，用于拉取会话列表与历史消息（REST 代理）。 */
const BACKEND_HTTP = 'http://localhost:8765'

/** 会话列表每页条数。 */
const SESSION_PAGE_SIZE = 50

export interface UseSessionsResult {
  /** 会话摘要列表。 */
  sessions: SessionSummary[]
  /** 会话总数。 */
  sessionsTotal: number
  /** 是否有更多可加载会话。 */
  hasMoreSessions: boolean
  /** 是否正在加载更多会话。 */
  isLoadingMore: boolean
  /** 当前选中的存储会话 ID。 */
  activeStoredId: string
  /** 是否正在打开历史会话。 */
  isSessionLoading: boolean
  /** 是否排除定时任务（cron）会话。 */
  excludeCron: boolean
  /** 新建会话并切换。返回 Promise，resolve 时携带消息列表（用于设置到对话区）。 */
  newSession: () => Promise<ChatMessage[]>
  /** 切换到某个历史会话。返回 Promise，resolve 时携带消息列表。 */
  selectSession: (storedId: string) => Promise<ChatMessage[] | undefined>
  /** 刷新会话列表（重置到第一页）。 */
  refreshSessions: () => void
  /** 加载更多会话（追加下一页）。 */
  loadMoreSessions: () => void
  /** 切换是否排除定时任务会话。 */
  toggleExcludeCron: () => void
  /** 显式标记会话加载结束。 */
  finishSessionLoading: () => void
}

/**
 * 管理会话列表与会话切换逻辑。
 *
 * @param clientRef - GatewayClient 实例引用
 * @param sessionIdRef - 共享的运行时 session_id ref（同时被 useConversation 读取）
 */
export function useSessions(
  clientRef: React.RefObject<GatewayClient | null>,
  sessionIdRef: React.MutableRefObject<string>
): UseSessionsResult {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionsTotal, setSessionsTotal] = useState(0)
  const [hasMoreSessions, setHasMoreSessions] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [activeStoredId, setActiveStoredId] = useState<string>('')
  const [isSessionLoading, setIsSessionLoading] = useState(false)
  const [excludeCron, setExcludeCron] = useState(true)

  const excludeCronRef = useRef(true)
  useEffect(() => {
    excludeCronRef.current = excludeCron
  }, [excludeCron])

  const sessionsLenRef = useRef(0)
  useEffect(() => {
    sessionsLenRef.current = sessions.length
  }, [sessions.length])

  const isSessionLoadingRef = useRef(false)
  useEffect(() => {
    isSessionLoadingRef.current = isSessionLoading
  }, [isSessionLoading])

  const fetchSessions = useCallback((reset: boolean) => {
    const offset = reset ? 0 : sessionsLenRef.current
    const excludeParam = excludeCronRef.current ? '&exclude_source=cron' : ''
    setIsLoadingMore(true)
    fetch(`${BACKEND_HTTP}/api/sessions?offset=${offset}&limit=${SESSION_PAGE_SIZE}${excludeParam}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<PaginatedSessionListResult>
      })
      .then((data) => {
        if (reset) {
          setSessions(data.sessions)
        } else {
          setSessions((prev) => [...prev, ...data.sessions])
        }
        setSessionsTotal(data.total)
        setHasMoreSessions(offset + data.sessions.length < data.total)
      })
      .catch(() => {
        /* 列表拉取失败不阻塞对话，静默即可 */
      })
      .finally(() => setIsLoadingMore(false))
  }, [])

  const refreshSessions = useCallback(() => fetchSessions(true), [fetchSessions])

  const loadMoreSessions = useCallback(() => {
    if (isLoadingMore || !hasMoreSessions) return
    fetchSessions(false)
  }, [fetchSessions, isLoadingMore, hasMoreSessions])

  const newSession = useCallback((): Promise<ChatMessage[]> => {
    const client = clientRef.current
    if (!client) return Promise.resolve([])
    return client
      .request<SessionCreateResult>('session.create', {
        source: 'hermes-cashew',
        instructions: '你运行在 hermes-cashew 中，这是一个腰果色温主题的桌面 AI 助手。'
      })
      .then((res) => {
        sessionIdRef.current = res.session_id
        setActiveStoredId(res.stored_session_id ?? '')
        setIsSessionLoading(false)
        refreshSessions()
        return mapHistory(res.messages)
      })
      .catch((e: Error) => {
        setIsSessionLoading(false)
        throw e
      })
  }, [clientRef, sessionIdRef, refreshSessions])

  const selectSession = useCallback(
    (storedId: string): Promise<ChatMessage[] | undefined> => {
      const client = clientRef.current
      if (
        !client ||
        isSessionLoadingRef.current ||
        storedId === activeStoredId
      ) {
        return Promise.resolve(undefined)
      }

      setIsSessionLoading(true)
      const restPromise = fetch(
        `${BACKEND_HTTP}/api/sessions/${encodeURIComponent(storedId)}/messages`
      )
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json() as Promise<SessionMessagesResult>
        })
        .then((data) => storedMessagesToChatMessages(data.messages ?? []))

      const resumePromise = client.request<SessionResumeResult>('session.resume', {
        session_id: storedId
      })

      return Promise.all([resumePromise, restPromise])
        .then(([resumeRes, messages]) => {
          sessionIdRef.current = resumeRes.session_id
          setActiveStoredId(storedId)
          setIsSessionLoading(false)
          return messages
        })
        .catch((e: Error) => {
          setIsSessionLoading(false)
          throw e
        })
    },
    [clientRef, sessionIdRef, activeStoredId]
  )

  const toggleExcludeCron = useCallback(() => {
    setExcludeCron((prev) => {
      const next = !prev
      excludeCronRef.current = next
      return next
    })
    // 切换后立即刷新列表（重置到第一页）
    setTimeout(() => fetchSessions(true), 0)
  }, [fetchSessions])

  const finishSessionLoading = useCallback(() => setIsSessionLoading(false), [])

  return {
    sessions,
    sessionsTotal,
    hasMoreSessions,
    isLoadingMore,
    activeStoredId,
    isSessionLoading,
    excludeCron,
    newSession,
    selectSession,
    refreshSessions,
    loadMoreSessions,
    toggleExcludeCron,
    finishSessionLoading
  }
}

/**
 * 把网关回放的历史消息映射成界面用的对话消息。
 * 只保留用户与助手的可见文本，丢弃 tool / system 等噪声。
 */
function mapHistory(history: GatewayMessage[] | undefined): ChatMessage[] {
  if (!history) return []
  return history
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && (m.text ?? '').trim() !== '')
    .map((m) => ({ role: m.role as ChatMessage['role'], parts: [textPart(m.text ?? '')] }))
}
