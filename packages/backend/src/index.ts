import { createServer } from 'node:http'
import 'dotenv/config'
import { startDashboard, stopDashboard } from './dashboard.js'
import { attachProxy } from './proxy.js'

/** 后端自身监听端口，默认 8765。 */
const PORT = Number(process.env.PORT ?? 8765)

/**
 * 后端入口：启动（或复用）Hermes dashboard，再起 http server，
 * 在 `/api/health` 提供健康检查、在 `/ws` 挂 WebSocket 桥接代理。
 */
async function main(): Promise<void> {
  const conn = await startDashboard()
  console.log(`[backend] dashboard 就绪 → ${conn.wsUrl.replace(/token=[^&]+/, 'token=***')}`)

  const server = createServer((req, res) => {
    if (req.url === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok' }))
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
