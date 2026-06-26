import { useCallback } from 'react'
import type { ConnectionState, GatewayClient } from '@/lib/gateway-client'
import { useGatewayClient } from '@/contexts/gateway'
import { useGatewayStore } from '@/stores/use-gateway-store'

export interface UseGatewayResult {
  /** GatewayClient 实例引用（来自 GatewayProvider，只读）。 */
  clientRef: React.RefObject<GatewayClient | null>
  /** 当前 WebSocket 连接状态。 */
  conn: ConnectionState
  /** 网关握手是否已完成。 */
  ready: boolean
  /** 网关错误消息。 */
  error: string | null
  /** 手动重连。 */
  reconnect: () => void
  /** 清除错误。 */
  clearError: () => void
}

/** 后端 WS 代理地址。 */
const BACKEND_WS = 'ws://localhost:8765/ws'

/**
 * 读取网关连接状态。
 *
 * 连接事件订阅在 GatewayProvider 中常驻，此 hook 仅从全局 Zustand store
 * 读取 `conn` / `ready` / `error`，提供 `reconnect` / `clearError` 动作。
 * 不传 onReady 时无副作用——调用方通过 `useEffect([ready])` 响应状态变化。
 */
export function useGateway(): UseGatewayResult {
  const clientRef = useGatewayClient()
  const conn = useGatewayStore((s) => s.conn)
  const ready = useGatewayStore((s) => s.ready)
  const error = useGatewayStore((s) => s.error)

  const reconnect = useCallback((): void => {
    const client = clientRef.current
    if (!client) return
    useGatewayStore.setState({ ready: false, error: null })
    client.connect(BACKEND_WS)
  }, [clientRef])

  const clearError = useCallback(() => {
    useGatewayStore.setState({ error: null })
  }, [])

  return { clientRef, conn, ready, error, reconnect, clearError }
}
