import { create } from 'zustand'
import type { ConnectionState } from '@/lib/gateway-client'

export interface GatewayState {
  /** WebSocket 连接状态。 */
  conn: ConnectionState
  /** 网关握手是否已完成。 */
  ready: boolean
  /** 网关错误消息（连接或事件层）。 */
  error: string | null
}

export interface GatewayActions {
  setConn: (conn: ConnectionState) => void
  setReady: (ready: boolean) => void
  setError: (error: string | null) => void
}

/**
 * 全局网关连接状态。
 *
 * 写入：GatewayProvider（常驻，不随路由切换卸载）。
 * 读取：useGateway hook 及任何需要连接状态的组件。
 */
export const useGatewayStore = create<GatewayState & GatewayActions>((set) => ({
  conn: 'connecting',
  ready: false,
  error: null,

  setConn: (conn) => set({ conn }),
  setReady: (ready) => set({ ready }),
  setError: (error) => set({ error })
}))
