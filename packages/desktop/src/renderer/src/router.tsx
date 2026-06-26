import { createHashRouter, createRoutesFromElements, Route } from 'react-router-dom'
import { GatewayProvider } from './contexts/gateway'
import { Layout } from './routes/layout'
import { Chat } from './routes/chat'
import { Settings } from './routes/settings'

/**
 * 应用路由定义。
 *
 * Electron 环境下使用 createHashRouter：基于 URL hash（`#/chat`, `#/settings`）
 * 的路由模式，不依赖服务端 History API fallback，兼容 file:// 协议加载。
 *
 * GatewayProvider 包裹所有路由，确保 GatewayClient 实例全应用共享。
 */
export const router = createHashRouter(
  createRoutesFromElements(
    <Route element={<GatewayProvider />}>
      <Route path="/" element={<Layout />}>
        <Route index element={<Chat />} />
        <Route path="chat" element={<Chat />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Route>
  )
)
