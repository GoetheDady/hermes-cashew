import { type ChildProcess, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** dashboard 就绪后，连接它所需的信息。 */
export interface DashboardConnection {
  /** 上游 JSON-RPC WebSocket 地址，已带鉴权 token。 */
  wsUrl: string
  /** 由后端持有的会话 token（前端不接触）。 */
  token: string
}

/** dashboard 就绪行：`HERMES_DASHBOARD_READY port=NNNN`。 */
const READY_RE = /HERMES_DASHBOARD_READY port=(\d+)/

/** 等待 dashboard 打印就绪行的超时（毫秒）。 */
const READY_TIMEOUT_MS = 30_000

/**
 * 解析 `hermes` 可执行文件路径：优先环境变量 `HERMES_BIN`，其次回退到
 * 默认安装位置 `~/.hermes/hermes-agent/venv/bin/hermes`，再不行就用 PATH 上的 `hermes`。
 *
 * @returns 可执行文件路径或命令名
 */
function resolveHermesBin(): string {
  if (process.env.HERMES_BIN) return process.env.HERMES_BIN
  const venvBin = join(homedir(), '.hermes', 'hermes-agent', 'venv', 'bin', 'hermes')
  if (existsSync(venvBin)) return venvBin
  return 'hermes'
}

/** 当前看管的 dashboard 子进程（用于退出时清理）。 */
let child: ChildProcess | null = null

/**
 * 启动并看管一个 `hermes dashboard` 子进程，等它就绪后返回 WS 连接信息。
 *
 * 若设置了 `HERMES_DASHBOARD_URL`，则跳过 spawn，直接复用已运行的 dashboard
 * （需配套 `HERMES_DASHBOARD_TOKEN`，或 URL 自带 token 查询参数）。
 *
 * @returns 解析为 {@link DashboardConnection}；启动失败或超时则 reject
 */
export function startDashboard(): Promise<DashboardConnection> {
  // 复用模式：直接使用外部已运行的 dashboard。
  const override = process.env.HERMES_DASHBOARD_URL
  if (override) {
    const token = process.env.HERMES_DASHBOARD_TOKEN ?? ''
    const wsUrl = token && !override.includes('token=')
      ? `${override}${override.includes('?') ? '&' : '?'}token=${token}`
      : override
    return Promise.resolve({ wsUrl, token })
  }

  // spawn 模式：自己生成 token 并启动子进程。
  const token = randomBytes(32).toString('base64url')
  const bin = resolveHermesBin()

  return new Promise<DashboardConnection>((resolve, reject) => {
    const proc = spawn(
      bin,
      ['dashboard', '--no-open', '--host', '127.0.0.1', '--port', '0'],
      { env: { ...process.env, HERMES_DASHBOARD_SESSION_TOKEN: token } }
    )
    child = proc

    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      proc.kill()
      reject(new Error(`dashboard 启动超时（${READY_TIMEOUT_MS}ms）`))
    }, READY_TIMEOUT_MS)

    // dashboard 把就绪行打到 stdout；匹配到端口即视为可用。
    proc.stdout?.on('data', (buf: Buffer) => {
      const line = buf.toString()
      const m = line.match(READY_RE)
      if (m && !settled) {
        settled = true
        clearTimeout(timer)
        const port = m[1]
        resolve({ wsUrl: `ws://127.0.0.1:${port}/api/ws?token=${token}`, token })
      }
    })

    // 子进程的 stderr 透传到后端日志，方便排查（如 hermes 未安装）。
    proc.stderr?.on('data', (buf: Buffer) => {
      process.stderr.write(`[dashboard] ${buf.toString()}`)
    })

    proc.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(`无法启动 dashboard（${bin}）：${err.message}`))
    })

    proc.on('exit', (code) => {
      child = null
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject(new Error(`dashboard 进程提前退出，code=${code}`))
      }
    })
  })
}

/** 杀掉看管的 dashboard 子进程（进程退出钩子调用）。 */
export function stopDashboard(): void {
  child?.kill()
  child = null
}
