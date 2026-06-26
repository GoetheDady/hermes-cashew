import { createContext, useContext, useLayoutEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { GatewayClient } from '@/lib/gateway-client'
import { useGatewayStore } from '@/stores/use-gateway-store'

/** 后端 WS 代理地址。 */
const BACKEND_WS = 'ws://localhost:8765/ws'

/** 共享的 GatewayClient 引用上下文。 */
const GatewayContext = createContext<React.RefObject<GatewayClient | null> | null>(null)

/**
 * GatewayProvider：创建并持有 GatewayClient 实例，管理连接状态订阅。
 *
 * 连接事件（onState / gateway.ready / error）在此直接订阅并写入
 * 全局 Zustand store——GatewayProvider 常驻，不随路由切换卸载，
 * 因此连接状态始终保持正确，不受 Chat 页面挂载/卸载影响。
 */
export function GatewayProvider(): React.JSX.Element {
  const clientRef = useRef<GatewayClient | null>(null)

  /**
   * useLayoutEffect（parent-first）确保子组件读取 store 时 client 已就绪。
   */
  useLayoutEffect(() => {
    const client = new GatewayClient()
    clientRef.current = client

    // ── 连接状态事件 —— 写入全局 store，常驻 ──
    client.onState((state) => {
      useGatewayStore.setState({ conn: state })
      if (state !== 'open') useGatewayStore.setState({ ready: false })
    })

    client.on('gateway.ready', () => {
      useGatewayStore.setState({ ready: true })
    })

    client.on('error', (evt) => {
      const message = (evt.payload as { message?: string } | undefined)?.message ?? '网关返回错误'
      useGatewayStore.setState({ error: message })
    })

    // StrictMode 下延迟连接。
    const timer = window.setTimeout(() => client.connect(BACKEND_WS), 0)

    return () => {
      window.clearTimeout(timer)
      client.close()
      useGatewayStore.setState({ conn: 'closed', ready: false, error: null })
    }
  }, [])

  return (
    <GatewayContext.Provider value={clientRef}>
      <Outlet />
    </GatewayContext.Provider>
  )
}

/**
 * 获取共享的 GatewayClient 引用。
 *
 * 必须在 `<GatewayProvider>` 子树内调用。
 */
export function useGatewayClient(): React.RefObject<GatewayClient | null> {
  const ctx = useContext(GatewayContext)
  if (!ctx) {
    throw new Error('useGatewayClient must be used within a GatewayProvider')
  }
  return ctx
}
