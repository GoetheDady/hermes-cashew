import { createServer, type ServerResponse } from 'node:http'
import 'dotenv/config'
import { type DashboardConnection, startDashboard, stopDashboard } from './dashboard.js'
import { attachProxy } from './proxy.js'

/** 后端自身监听端口，默认 8765。 */
const PORT = Number(process.env.PORT ?? 8765)

/** dashboard 鉴权 header 名（与 hermes web_server 的 _SESSION_HEADER_NAME 一致）。 */
const SESSION_HEADER = 'X-Hermes-Session-Token'

/**
 * 把历史消息 REST 请求转发到 dashboard，并把响应回传给前端。
 *
 * @param sessionId - 存储会话 ID（路径参数）
 * @param conn - dashboard 连接信息（含 httpBase 与 token）
 * @param res - 前端的响应对象
 */
async function proxySessionMessages(
  sessionId: string,
  conn: DashboardConnection,
  res: ServerResponse
): Promise<void> {
  const url = `${conn.httpBase}/api/sessions/${encodeURIComponent(sessionId)}/messages`
  const upstream = await fetch(url, {
    headers: { [SESSION_HEADER]: conn.token },
  })
  const body = await upstream.text()
  res.writeHead(upstream.status, { 'content-type': 'application/json' })
  res.end(body)
}

/**
 * 后端入口：启动（或复用）Hermes dashboard，再起 http server，
 * 在 `/api/health` 提供健康检查、在 `/ws` 挂 WebSocket 桥接代理。
 */
async function main(): Promise<void> {
  const conn = await startDashboard()
  console.log(`[backend] dashboard 就绪 → ${conn.wsUrl.replace(/token=[^&]+/, 'token=***')}`)

  const server = createServer((req, res) => {
    // 前端 renderer 跨域（vite dev server / file://）请求本后端 REST，
    // 必须放行 CORS，否则浏览器拦截响应导致 fetch reject。
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.url === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok' }))
      return
    }

    // 代理历史消息 REST：转发到 dashboard 的 /api/sessions/:id/messages，
    // 带上后端持有的 token。前端用它加载含 reasoning 的完整历史（session.resume 不含）。
    const msgMatch = req.url?.match(/^\/api\/sessions\/([^/]+)\/messages$/)
    if (msgMatch && req.method === 'GET') {
      proxySessionMessages(msgMatch[1], conn, res).catch((err) => {
        console.error('[backend] 历史消息代理失败:', err instanceof Error ? err.message : err)
        if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'upstream_failed' }))
      })
      return
    }

    res.writeHead(404)
    res.end()
  })

  attachProxy(server, conn)

  server.listen(PORT, () => {
    console.log(`[backend] 监听 http://localhost:${PORT}（WS 代理在 /ws）`)
  })
}

// 进程退出时清理 dashboard 子进程，避免遗留孤儿。
for (const sig of ['exit', 'SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    stopDashboard()
    if (sig !== 'exit') process.exit(0)
  })
}

main().catch((err) => {
  console.error('[backend] 启动失败:', err instanceof Error ? err.message : err)
  stopDashboard()
  process.exit(1)
})
