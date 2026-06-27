import { useEffect, useRef } from 'react'
import type { ChatMessage } from '@hermes/shared'
import { chatMessageText } from '@hermes/shared'

/** 后端 HTTP 基址。 */
const BACKEND_HTTP = 'http://localhost:8765'

/** 开发环境通知间隔（分钟）。 */
const DEV_MIN_MINUTES = 1
const DEV_MAX_MINUTES = 2

/** 生产环境通知间隔（分钟）。 */
const PROD_MIN_MINUTES = 2
const PROD_MAX_MINUTES = 60

/** 通知上下文中包含的最近对话轮数。 */
const CONTEXT_ROUNDS = 3

/**
 * 判断当前是否在开发环境（renderer 通过 dev server 加载，而非 file://）。
 */
function isDev(): boolean {
  return !window.location.protocol.startsWith('file')
}

/**
 * 在 [min, max] 分钟范围内生成随机毫秒数。
 */
function randomInterval(minMinutes: number, maxMinutes: number): number {
  const minMs = minMinutes * 60_000
  const maxMs = maxMinutes * 60_000
  return minMs + Math.random() * (maxMs - minMs)
}

/**
 * 从消息列表中提取最近 N 轮对话，格式化为纯文本上下文。
 *
 * 一轮 = 一条 user 消息 + 紧接着的一条 assistant 消息。
 * 从列表末尾往前取 CONTEXT_ROUNDS 轮，取到后按时间正序排列。
 *
 * @param messages - 当前对话消息列表
 * @returns 格式化后的对话文本，空列表返回空字符串
 */
function buildContext(messages: ChatMessage[]): string {
  // 从末尾往前收集 N 个 user-assistant 配对
  const pairs: { user: string; assistant: string }[] = []
  let lookingFor: 'user' | 'assistant' = 'assistant'

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'assistant' && lookingFor === 'assistant') {
      const text = chatMessageText(m).trim()
      if (text) {
        pairs.unshift({ user: '', assistant: text })
        lookingFor = 'user'
      }
    } else if (m.role === 'user' && lookingFor === 'user' && pairs.length > 0) {
      const text = chatMessageText(m).trim()
      if (text) {
        pairs[0].user = text
        lookingFor = 'assistant'
        if (pairs.length >= CONTEXT_ROUNDS) break
      }
    }
  }

  // 过滤掉没有用户消息的不完整配对
  const complete = pairs.filter((p) => p.user)

  if (complete.length === 0) return ''

  return complete
    .map((p) => `用户：${p.user}\n助手：${p.assistant}`)
    .join('\n\n')
}

export interface UseIdleNotifyInput {
  /** 当前对话消息列表。 */
  messages: ChatMessage[]
  /** 是否正在流式接收助手回复。 */
  isStreaming: boolean
  /** 网关握手是否已完成。 */
  ready: boolean
}

/**
 * 管理空闲通知调度：用户停止对话后，随机延迟后通过系统通知弹一句
 * Hermes 生成的追问文案。用户重新开始输入时取消计时器，
 * Hermes 回复完毕后重新开始一轮。
 *
 * 开发环境间隔 [1, 2] 分钟，打包后 [2, 60] 分钟。
 *
 * @param input - messages、isStreaming、ready 状态
 */
export function useIdleNotify({ messages, isStreaming, ready }: UseIdleNotifyInput): void {
  const timerRef = useRef<number>(0)
  const lastAssistantTimeRef = useRef<number>(0)

  // 计算"最后一条 assistant 消息到达时刻"
  let lastAssistantTime = lastAssistantTimeRef.current
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant' && chatMessageText(messages[i]).trim()) {
      lastAssistantTime = Date.now()
      break
    }
  }
  lastAssistantTimeRef.current = lastAssistantTime

  const isIdle =
    ready &&
    !isStreaming &&
    (messages.length === 0 || messages[messages.length - 1]?.role === 'assistant')

  /** 调度下一次通知。 */
  const scheduleNext = (): number => {
    const [minMin, maxMin] = isDev() ? [DEV_MIN_MINUTES, DEV_MAX_MINUTES] : [PROD_MIN_MINUTES, PROD_MAX_MINUTES]
    const delay = randomInterval(minMin, maxMin)
    return window.setTimeout(async () => {
      // 生成时取当前消息快照的上下文
      const context = buildContext(messages)

      try {
        const res = await fetch(`${BACKEND_HTTP}/api/presence/notify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ context })
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { text: string }
        window.api.showNotification('hermes-cashew', data.text)
      } catch {
        // 请求失败不弹通知，等下一轮
      }

      // 弹完通知后调度下一次
      timerRef.current = scheduleNext()
    }, delay)
  }

  useEffect(() => {
    if (!isIdle) {
      // 用户活跃：取消计时器
      window.clearTimeout(timerRef.current)
      return
    }

    // 空闲态：启动计时器
    window.clearTimeout(timerRef.current)
    timerRef.current = scheduleNext()

    return () => window.clearTimeout(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIdle, lastAssistantTime])
}
