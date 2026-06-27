import { WebSocket } from 'ws'
import type { DashboardConnection } from './dashboard.js'

/**
 * PresenceEngine 控制器：暴露当前提示词缓冲区和停止方法。
 *
 * 前端通过 `GET /api/presence/prompts` 消费 `getPrompts()` 返回的快照，
 * 后端退出时通过 `stop()` 清理 WS 连接和定时器。
 */
export interface PresenceController {
  getPrompts(): string[]
  stop(): void
}

/** 环形缓冲区最大容量。 */
const MAX_BUFFER_SIZE = 10

/** 生成间隔（毫秒）：5 分钟。 */
const GENERATE_INTERVAL_MS = 5 * 60 * 1000

/** 内置兜底文案：当 Hermes 尚未生成任何内容或全部失败时使用。 */
const FALLBACK_PROMPTS: string[] = [
  '有什么想聊的，随时开口。',
  '我在听。',
  '任何问题都可以问我。',
  '今天有什么计划？',
  '代码、想法，或者随便聊聊。'
]

/**
 * 发送给 Hermes 的生成提示词：让它生成简短、温暖、口语化的中文问候语。
 *
 * 提示词设计要点：
 * - 明确输出格式（每行一条，无编号、无引号、无额外说明），方便解析。
 * - 角色定位为"内心独白"，避免机械的客服话术。
 * - 字数限制 20 字，保证适合在空态中一行展示。
 */
const GENERATION_PROMPT = [
  '生成5条简短的问候语，每条不超过20个汉字。',
  '你就是这个对话助手的内心独白，像一个朋友在旁边等待时随口的轻声话语。',
  '语气温暖自然，口语化，不要书面语。',
  '输出格式：每行一条，不要编号，不要引号，不要任何额外说明。'
].join(' ')

/**
 * 解析 Hermes 返回的批量问候语。
 *
 * 按行拆分 → 去除首尾空白 → 过滤空行 → 去掉包裹引号 → 截断过长行。
 *
 * @param raw - Hermes 返回的原始文本
 * @returns 清洗后的问候语数组
 */
function parsePrompts(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^["'""'']|["'""'']$/g, '').trim())
    .filter((line) => line.length > 0 && line.length <= 40)
}

/**
 * 最小 JSON-RPC 2.0 客户端，仅实现 PresenceEngine 所需的能力：
 * request（发送请求并等待响应）和 onEvent（订阅推送事件）。
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

  /**
   * 发送 JSON-RPC 请求并等待响应。
   *
   * @param method - 方法名
   * @param params - 参数对象
   * @param timeoutMs - 超时毫秒数（默认 60s）
   * @returns 解析为服务端返回的 result
   */
  request<T = unknown>(method: string, params: Record<string, unknown> = {}, timeoutMs = 60_000): Promise<T> {
    const id = `p${++this.nextId}`
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`请求超时: ${method}`))
      }, timeoutMs)
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
        timer
      })
      this.ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
    })
  }

  /**
   * 订阅某类网关事件。
   *
   * @param type - 事件类型（如 `message.delta`）
   * @param handler - 事件处理函数
   * @returns 取消订阅的函数
   */
  onEvent(type: string, handler: (payload: unknown) => void): () => void {
    let set = this.eventHandlers.get(type)
    if (!set) {
      set = new Set()
      this.eventHandlers.set(type, set)
    }
    set.add(handler)
    return () => set?.delete(handler)
  }

  /** 解析一帧：是响应就配对 Promise，是事件就分发。 */
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

  /** 拒绝所有等待中的请求（连接关闭时调用）。 */
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
 * 周期性用临时会话生成空闲问候语，拿到结果后立即删除会话，不污染上下文。
 *
 * @param conn - dashboard 连接信息（wsUrl、httpBase、token）
 * @returns PresenceController，暴露 getPrompts() 和 stop()
 */
export function startPresence(conn: DashboardConnection): PresenceController {
  const buffer: string[] = []
  let rpc: JsonRpcClient | null = null
  let generateTimer: NodeJS.Timeout | null = null
  let stopped = false

  /**
   * 用临时会话生成一批问候语，拿到结果后立即删除会话。
   *
   * 流程：session.create → prompt.submit → 等待 message.complete → session.delete → 解析入缓冲。
   * 每一步失败都尝试清理临时会话，确保不留孤儿。
   * 失败时静默忽略（不清空已有缓冲），由兜底文案保证前端始终有内容可展示。
   */
  async function generateBatch(): Promise<void> {
    if (!rpc || stopped) return

    let tempSessionId: string | null = null

    /**
     * 尝试删除临时会话，失败不抛错（dashboard 可能不支持或已清理）。
     */
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
        text: GENERATION_PROMPT
      })

      // 3. 等待 message.complete，累积 delta
      const completeText = await new Promise<string>((resolve, reject) => {
        let accumulated = ''
        const timeout = setTimeout(() => reject(new Error('等待生成响应超时')), 120_000)

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

      // 5. 解析并推入缓冲区
      const parsed = parsePrompts(completeText)
      for (const prompt of parsed) {
        if (buffer.length >= MAX_BUFFER_SIZE) buffer.shift()
        buffer.push(prompt)
      }

      console.log(`[presence] 生成完成，获得 ${parsed.length} 条，缓冲区共 ${buffer.length} 条`)
    } catch (err) {
      console.error('[presence] 生成失败:', err instanceof Error ? err.message : err)
      // 失败也尝试清理
      await tryDelete()
    }
  }

  // ── 建立 WS 连接 ──
  const ws = new WebSocket(conn.wsUrl)

  ws.on('open', () => {
    if (stopped) {
      ws.close()
      return
    }

    rpc = new JsonRpcClient(ws)

    // 立即生成第一批
    generateBatch().catch((err) => {
      console.error('[presence] 初始生成失败:', err instanceof Error ? err.message : err)
    })

    // 之后每 5 分钟生成一批
    generateTimer = setInterval(() => {
      generateBatch().catch((err) => {
        console.error('[presence] 定时生成失败:', err instanceof Error ? err.message : err)
      })
    }, GENERATE_INTERVAL_MS)
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
    getPrompts(): string[] {
      return buffer.length > 0 ? [...buffer] : FALLBACK_PROMPTS
    },

    stop(): void {
      stopped = true
      if (generateTimer) {
        clearInterval(generateTimer)
        generateTimer = null
      }
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
      rpc?.rejectAll(new Error('PresenceEngine 已停止'))
      rpc = null
      console.log('[presence] 已停止')
    }
  }
}
