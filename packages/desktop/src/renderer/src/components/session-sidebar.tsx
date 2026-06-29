import type { SessionSummary } from '@hermes/shared'
import type { ConnectionState } from '@/lib/gateway-client'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/status-badge'
import { SESSION_SIDEBAR_CLASS } from '@/lib/session-sidebar-layout'
import { Clock, LoaderCircle, MessageSquare, Plus } from 'lucide-react'

export interface SessionSidebarProps {
  sessions: SessionSummary[]
  sessionsTotal: number
  hasMoreSessions: boolean
  isLoadingMore: boolean
  activeStoredId: string
  ready: boolean
  isStreaming: boolean
  isSessionLoading: boolean
  conn: ConnectionState
  /** 是否排除定时任务（cron）会话。 */
  excludeCron: boolean
  onNewSession: () => void
  onSelectSession: (storedId: string) => void
  onLoadMore: () => void
  onReconnect: () => void
  /** 切换是否排除定时任务会话。 */
  onToggleExcludeCron: () => void
  /** 底部区域额外内容（如设置按钮）。 */
  footerSlot?: React.ReactNode
}

/**
 * 左侧会话历史栏，包含新建入口、分组标题、可滚动历史列表和连接状态。
 */
export function SessionSidebar({
  sessions,
  sessionsTotal,
  hasMoreSessions,
  isLoadingMore,
  activeStoredId,
  ready,
  isStreaming,
  isSessionLoading,
  conn,
  excludeCron,
  onNewSession,
  onSelectSession,
  onLoadMore,
  onReconnect,
  onToggleExcludeCron,
  footerSlot
}: SessionSidebarProps): React.JSX.Element {
  return (
    <aside className={SESSION_SIDEBAR_CLASS}>
      <div className="space-y-3 px-3 py-3">
        <Button
          variant="default"
          size="sm"
          className="w-full justify-start shadow-sm"
          onClick={onNewSession}
          disabled={!ready || isStreaming || isSessionLoading}
        >
          <Plus data-icon="inline-start" />
          新建会话
        </Button>
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MessageSquare className="size-3.5" />
            <span>会话历史</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleExcludeCron}
              className={[
                'inline-flex size-5 items-center justify-center rounded transition-colors',
                excludeCron
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              ].join(' ')}
              title={
                excludeCron ? '已隐藏定时任务会话（点击显示）' : '显示全部会话（点击隐藏定时任务）'
              }
              aria-pressed={excludeCron}
            >
              <Clock className="size-3" />
            </button>
            {sessionsTotal > 0 && (
              <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[0.7rem]">
                {sessionsTotal}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <Separator className="bg-sidebar-border" />
      <ScrollArea className="min-h-0 flex-1">
        <nav className="space-y-1.5 px-2 py-3" aria-label="会话历史">
          {sessions.length === 0 && <EmptySessionHistory />}
          {sessions.map((session) => (
            <SessionHistoryItem
              key={session.id}
              session={session}
              isActive={session.id === activeStoredId}
              disabled={isStreaming || isSessionLoading}
              onSelect={onSelectSession}
            />
          ))}
          {hasMoreSessions && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={onLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <>
                  <LoaderCircle className="size-3 animate-spin" />
                  加载中…
                </>
              ) : (
                '加载更多'
              )}
            </Button>
          )}
        </nav>
      </ScrollArea>
      <Separator className="bg-sidebar-border" />
      <div className="px-3 py-2 space-y-2">
        <StatusBadge conn={conn} ready={ready} onReconnect={onReconnect} />
        {footerSlot}
      </div>
    </aside>
  )
}

function SessionHistoryItem({
  session,
  isActive,
  disabled,
  onSelect
}: {
  session: SessionSummary
  isActive: boolean
  disabled: boolean
  onSelect: (storedId: string) => void
}): React.JSX.Element {
  const title = session.title?.trim() || session.preview?.trim() || '未命名会话'
  const preview = session.preview?.trim() || '还没有可显示的消息预览'
  const meta =
    Number.isFinite(session.message_count) && session.message_count > 0
      ? `${session.message_count} 条`
      : ''

  return (
    <Button
      variant="ghost"
      size="sm"
      className={[
        'h-auto min-h-16 w-full items-start justify-start whitespace-normal rounded-md px-2.5 py-2 text-left',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isActive
          ? 'border border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
          : 'border border-transparent'
      ].join(' ')}
      onClick={() => onSelect(session.id)}
      disabled={disabled}
      title={title}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="flex min-w-0 w-full flex-1 flex-col gap-1 overflow-hidden">
        <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <span className="min-w-0 truncate text-[0.82rem] font-medium leading-5">{title}</span>
          {meta && <span className="shrink-0 text-[0.68rem] text-muted-foreground">{meta}</span>}
        </span>
        <span className="line-clamp-2 min-w-0 overflow-hidden break-all text-[0.72rem] leading-4 text-muted-foreground">
          {preview}
        </span>
      </span>
    </Button>
  )
}

function EmptySessionHistory(): React.JSX.Element {
  return (
    <div className="mx-1 rounded-md border border-dashed border-sidebar-border bg-background/35 px-3 py-5 text-center">
      <p className="text-xs font-medium text-foreground">暂无历史会话</p>
      <p className="mt-1 text-[0.72rem] leading-4 text-muted-foreground">新建会话后会显示在这里</p>
    </div>
  )
}
