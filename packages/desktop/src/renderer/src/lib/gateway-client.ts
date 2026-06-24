import type { GatewayEvent, GatewayEventName, JsonRpcFrame } from '@hermes/shared'

/** 连接状态。 */
export type ConnectionState = 'connecting' | 'open' | 'closed' | 'error'

/** RPC 调用超时（毫秒）。 */
const REQUEST_TIMEOUT_MS = 120_000

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: number }

/**
 * 精简版 Hermes 网关客户端：JSON-RPC 2.0 over WebSocket。
 *
 * 负责把 `request()` 的调用与服务端按 `id` 返回的响应配对成 Promise，
 * 并把服务端推送的 `event` 帧分发给 `on()` 注册的处理器。
 * 仅实现本应用所需的最小能力（连接、请求、事件订阅、状态订阅）。
 */
export class GatewayClient {
  private socket: WebSocket | null = null
  private nextId = 0
  private readonly pending = new Map<string, Pending>()
  private readonly handlers = new Map<string, Set<(e: GatewayEvent) => void>>()
  private readonly stateHandlers = new Set<(s: ConnectionState) => void>()

  /**
   * 连接到网关 WebSocket。
   *
   * @param url - WS 地址（如 `ws://localhost:8765/ws`）
   */
  connect(url: string): void {
    this.setState('connecting')
    const socket = new WebSocket(url)
    this.socket = socket

    socket.addEventListener('open', () => this.setState('open'))
    socket.addEventListener('close', () => {
      this.setState('closed')
      this.rejectAll(new Error('连接已关闭'))
    })
    socket.addEventListener('error', () => this.setState('error'))
    socket.addEventListener('message', (ev) => this.handleFrame(String(ev.data)))
  }

  /**
   * 发起一次 JSON-RPC 调用，返回服务端 `result`。
   *
   * @param method - 方法名（如 `session.create`、`prompt.submit`）
   * @param params - 方法参数
   * @returns 解析为服务端返回的 result；失败或超时则 reject
   */
  request<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const socket = this.socket
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('网关未连接'))
    }
    const id = `r${++this.nextId}`
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`请求超时: ${method}`))
      }, REQUEST_TIMEOUT_MS)
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject, timer })
      socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
    })
  }

  /**
   * 订阅某类网关事件。
   *
   * @param type - 事件名（如 `message.delta`）
   * @param handler - 收到事件时调用
   * @returns 取消订阅的函数
   */
  on<P = unknown>(type: GatewayEventName, handler: (e: GatewayEvent<P>) => void): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(handler as (e: GatewayEvent) => void)
    return () => set?.delete(handler as (e: GatewayEvent) => void)
  }

  /**
   * 订阅连接状态变化，注册时会立即回调一次当前状态。
   *
   * @param handler - 状态变化时调用
   * @returns 取消订阅的函数
   */
  onState(handler: (s: ConnectionState) => void): () => void {
    this.stateHandlers.add(handler)
    handler(this.state)
    return () => this.stateHandlers.delete(handler)
  }

  /** 关闭连接。 */
  close(): void {
    this.socket?.close()
    this.socket = null
  }

  private state: ConnectionState = 'connecting'

  private setState(s: ConnectionState): void {
    if (this.state === s) return
    this.state = s
    for (const h of this.stateHandlers) h(s)
  }

  /** 解析一帧：是响应就配对 Promise，是事件就分发。 */
  private handleFrame(raw: string): void {
    let frame: JsonRpcFrame
    try {
      frame = JSON.parse(raw) as JsonRpcFrame
    } catch {
      return
    }

    if (frame.id !== undefined && frame.id !== null) {
      const call = this.pending.get(String(frame.id))
      if (!call) return
      window.clearTimeout(call.timer)
      this.pending.delete(String(frame.id))
      if (frame.error) call.reject(new Error(frame.error.message || 'RPC 失败'))
      else call.resolve(frame.result)
      return
    }

    if (frame.method === 'event' && frame.params?.type) {
      const evt = frame.params
      for (const h of this.handlers.get(evt.type) ?? []) h(evt)
    }
  }

  private rejectAll(err: Error): void {
    for (const [, call] of this.pending) {
      window.clearTimeout(call.timer)
      call.reject(err)
    }
    this.pending.clear()
  }
}
