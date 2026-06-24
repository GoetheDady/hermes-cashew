import type { Server } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import type { DashboardConnection } from './dashboard.js'

/**
 * 在给定 http server 上挂一个 WebSocket 代理（路径 `/ws`）。
 *
 * 每个前端连接独占一条到 Hermes dashboard 的上游连接，两端之间透传
 * JSON-RPC 帧（不解析内容）。token 只用于后端→dashboard 这一跳，前端不接触。
 *
 * @param server - 已创建的 http server
 * @param conn - dashboard 连接信息（来自 {@link DashboardConnection}）
 */
export function attachProxy(server: Server, conn: DashboardConnection): void {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (client: WebSocket) => {
    // 上游未 open 前，先把前端发来的帧缓冲起来，open 后补发。
    const buffered: string[] = []
    const upstream = new WebSocket(conn.wsUrl)

    upstream.on('open', () => {
      for (const frame of buffered) upstream.send(frame)
      buffered.length = 0
    })

    // 上游 → 前端：原样转发。
    upstream.on('message', (data) => {
      if (client.readyState === WebSocket.OPEN) client.send(data.toString())
    })

    // 前端 → 上游：open 前缓冲，open 后直发。
    client.on('message', (data) => {
      const frame = data.toString()
      if (upstream.readyState === WebSocket.OPEN) upstream.send(frame)
      else buffered.push(frame)
    })

    // 任一端关闭/出错，连带关闭另一端，避免半开连接。
    const closeBoth = (): void => {
      if (client.readyState === WebSocket.OPEN) client.close()
      if (upstream.readyState === WebSocket.OPEN) upstream.close()
    }
    client.on('close', closeBoth)
    client.on('error', closeBoth)
    upstream.on('close', closeBoth)
    upstream.on('error', (err) => {
      console.error('[proxy] 上游连接错误:', err.message)
      closeBoth()
    })
  })
}
