import type { ConnectionState } from '@/lib/gateway-client'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export interface StatusBadgeProps {
  conn: ConnectionState
  ready: boolean
  onReconnect: () => void
}

/**
 * 连接状态指示器：三色圆点 + 文字 + 断连时重连按钮。
 *
 * - 🟢 绿色：已连接（conn === 'open' && ready）
 * - 🟡 黄色：连接中 / 握手中（conn === 'connecting' 或 open 但未 ready）
 * - 🔴 红色：已断开（conn === 'closed' || 'error'），附带重连按钮
 */
export function StatusBadge({ conn, ready, onReconnect }: StatusBadgeProps): React.JSX.Element {
  const connected = conn === 'open' && ready
  const pending = conn === 'connecting' || (conn === 'open' && !ready)
  const disconnected = conn === 'closed' || conn === 'error'

  const dotColor = connected ? 'bg-green-500' : pending ? 'bg-yellow-500' : 'bg-red-500'
  const label = connected ? '已连接' : pending ? '连接中' : '已断开'

  return (
    <div className="flex items-center gap-2">
      <span className={['inline-block size-2 shrink-0 rounded-full', dotColor].join(' ')} />
      <span className="text-xs text-muted-foreground">{label}</span>
      {disconnected && (
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onReconnect}
          title="重新连接"
          aria-label="重新连接"
          className="ml-auto"
        >
          <RefreshCw />
        </Button>
      )}
    </div>
  )
}
