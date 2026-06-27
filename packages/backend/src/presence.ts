import { WebSocket } from 'ws'
import type { DashboardConnection } from './dashboard.js'

/**
 * PresenceEngine 控制器：暴露按需通知文案生成和停止方法。
 *
 * 前端通过 `POST /api/presence/notify` 传入对话上下文，
 * PresenceEngine 用临时会话让 Hermes 生成一句针对性追问后立即删除会话。
 */
export interface PresenceController {
  /**
   * 根据对话上下文生成一句通知文案。
   *
   * 用临时会话一次性完成：session.create → prompt.submit →
   * 等待 message.complete → session.delete → 返回文案。
   * 空上下文时 Hermes 生成邀请式问候，有上下文时生成针对性追问。
   *
   * @param context - 最近对话摘要（空字符串表示尚无对话）
   * @returns 通知文案字符串
   */
  generateNotify(context: string): Promise<string>

  /** 停止 PresenceEngine：关闭 WS 连接。 */
  stop(): void
}

/** 生成超时（毫秒）。 */
const GENERATE_TIMEOUT_MS = 30_000

/** 兜底通知文案：当 Hermes 生成失败时使用。 */
const FALLBACK_NOTIFY: string[] = [
  '还在吗？',
  '怎么不理我了？',
  '你在干什么呢？',
  '有什么想聊的，随时开口。'
]

/** 有上下文时的提示词模板。 */
const NOTIFY_WITH_CONTEXT = [
  '以下是你和用户最近的一段对话。用户已经沉默了好几分钟。',
  '请你生成一句简短的话（不超过25个汉字），像一个朋友发现对方不说话了，轻轻来问一句。',
  '语气自然、温暖、带一点关心，不要正式、不要客服语气。',
  '只说这一句话（不要引号、不要说"我可以帮你..."之类的客套话）。',
  '',
  '--- 最近对话 ---'
].join('\n')

/** 无上下文（空态）时的提示词模板。 */
const NOTIFY_EMPTY_CONTEXT = [
  '用户打开了对话框但还没开始说话。',
  '请你生成一句简短的话（不超过25个汉字），像一个朋友在旁边，',
  '轻轻问一句今天想聊什么、有什么可以帮忙的。',
  '语气自然、温暖、口语化，不要正式、不要客服语气。',
  '只说这一句话，不要引号，不要任何额外内容。'
].join('\n')

/**
 * 解析 Hermes 返回的通知文案：取第一行有效文本，去引号，截断过长。
 */
function parseNotifyText(raw: string): string {
  const line = raw
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0)

  if (!line) return FALLBACK_NOTIFY[0]

  const cleaned = line.replace(/^["'""'']|["'""'']$/g, '').trim()
  if (!cleaned) return FALLBACK_NOTIFY[0]
  return cleaned.length > 40 ? cleaned.slice(0, 40) : cleaned
}

/**
 * 最小 JSON-RPC 2.0 客户端。
 */
class JsonRpcClient {
  private nextId = 0
  private pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
  >()
  private eventHandlers = new Map<string, Set<(payload: unknown) => void>>()

  constructor(private ws: WebSocket) {
    ws.on('message', (data: Buffer) => {
      this.handleFrame(data.toString())
    })
  }

  request<T = unknown>(method: string, params: Record<string, unknown> = {}, timeoutMs = 60_000): Promise<T> {
    const id = `p${++this.nextId}`
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`请求超时: ${method}`))
      }, timeoutMs)
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject, timer })
      this.ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
    })
  }

  onEvent(type: string, handler: (payload: unknown) => void): () => void {
    let set = this.eventHandlers.get(type)
    if (!set) {
      set = new Set()
      this.eventHandlers.set(type, set)
    }
    set.add(handler)
    return () => set?.delete(handler)
  }

  private handleFrame(raw: string): void {
    let frame: { jsonrpc?: string; id?: string | number | null; method?: string; params?: { type?: string; payload?: unknown }; result?: unknown; error?: { message?: string } }
    try {
      frame = JSON.parse(raw)
    } catch {
      return
    }

    if (frame.id !== undefined && frame.id !== null) {
      const call = this.pending.get(String(frame.id))
      if (!call) return
      clearTimeout(call.timer)
      this.pending.delete(String(frame.id))
      if (frame.error) call.reject(new Error(frame.error.message || 'RPC 失败'))
      else call.resolve(frame.result)
      return
    }

    if (frame.method === 'event' && frame.params?.type) {
      const handlers = this.eventHandlers.get(frame.params.type)
      if (handlers) {
        for (const h of handlers) h(frame.params.payload)
      }
    }
  }

  rejectAll(err: Error): void {
    for (const [, call] of this.pending) {
      clearTimeout(call.timer)
      call.reject(err)
    }
    this.pending.clear()
  }
}

/**
 * 启动 PresenceEngine：建立到 Hermes dashboard 的独立 WS 连接，
 * 提供按需通知文案生成能力。每次生成使用临时会话，用完即删。
 *
 * @param conn - dashboard 连接信息
 * @returns PresenceController
 */
export function startPresence(conn: DashboardConnection): PresenceController {
  let rpc: JsonRpcClient | null = null
  let stopped = false

  // 建立 WS 连接
  const ws = new WebSocket(conn.wsUrl)

  ws.on('open', () => {
    if (stopped) {
      ws.close()
      return
    }
    rpc = new JsonRpcClient(ws)
    console.log('[presence] WS 已连接')
  })

  ws.on('error', (err) => {
    console.error('[presence] WS 连接错误:', err.message)
  })

  ws.on('close', () => {
    if (!stopped) {
      console.error('[presence] WS 连接意外关闭')
    }
    rpc?.rejectAll(new Error('连接已关闭'))
    rpc = null
  })

  return {
    /**
     * 根据对话上下文生成一句通知文案。
     */
    async generateNotify(context: string): Promise<string> {
      if (!rpc) {
        // WS 还没连上时直接返回兜底文案
        return FALLBACK_NOTIFY[Math.floor(Math.random() * FALLBACK_NOTIFY.length)]
      }

      const promptText = context
        ? `${NOTIFY_WITH_CONTEXT}\n${context}`
        : NOTIFY_EMPTY_CONTEXT

      let tempSessionId: string | null = null

      const tryDelete = async (): Promise<void> => {
        if (!tempSessionId || !rpc) return
        try {
          await rpc.request('session.delete', { session_id: tempSessionId }, 10_000)
        } catch {
          // session.delete 可能不被支持，静默忽略
        }
      }

      try {
        // 1. 创建临时会话
        const createRes = await rpc.request<{ session_id: string }>('session.create', {
          source: 'hermes-presence-temp'
        })
        tempSessionId = createRes.session_id

        // 2. 提交生成请求
        await rpc.request('prompt.submit', {
          session_id: tempSessionId,
          text: promptText
        })

        // 3. 等待 message.complete
        const completeText = await new Promise<string>((resolve, reject) => {
          let accumulated = ''
          const timeout = setTimeout(() => reject(new Error('等待生成响应超时')), GENERATE_TIMEOUT_MS)

          const unsubDelta = rpc!.onEvent('message.delta', (payload) => {
            const text = (payload as { text?: string } | undefined)?.text
            if (text) accumulated += text
          })

          const unsubComplete = rpc!.onEvent('message.complete', (payload) => {
            clearTimeout(timeout)
            unsubDelta()
            unsubComplete()
            const text = (payload as { text?: string } | undefined)?.text ?? accumulated
            resolve(text)
          })
        })

        // 4. 删除临时会话
        await tryDelete()

        // 5. 解析并返回
        const result = parseNotifyText(completeText)
        console.log(`[presence] 通知文案生成: "${result}"`)
        return result
      } catch (err) {
        console.error('[presence] 通知生成失败:', err instanceof Error ? err.message : err)
        await tryDelete()
        return FALLBACK_NOTIFY[Math.floor(Math.random() * FALLBACK_NOTIFY.length)]
      }
    },

    stop(): void {
      stopped = true
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
      rpc?.rejectAll(new Error('PresenceEngine 已停止'))
      rpc = null
      console.log('[presence] 已停止')
    }
  }
}
