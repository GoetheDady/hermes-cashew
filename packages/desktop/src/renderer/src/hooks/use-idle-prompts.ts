import { useCallback, useEffect, useRef, useState } from 'react'

/** 后端 HTTP 基址。 */
const BACKEND_HTTP = 'http://localhost:8765'

/** 提示词刷新间隔（毫秒）：60 秒拉一次新批次。 */
const FETCH_INTERVAL_MS = 60_000

/** 轮播间隔范围（毫秒）：8~15 秒随机。 */
const ROTATE_MIN_MS = 8_000
const ROTATE_MAX_MS = 15_000

/** 内置兜底文案：Hermes 尚未生成或接口不可用时使用。 */
const FALLBACK_PROMPTS: string[] = [
  '有什么想聊的，随时开口。',
  '我在听。',
  '任何问题都可以问我。'
]

export interface UseIdlePromptsResult {
  /** 当前可用的所有提示词（空数组时调用方应使用兜底文案）。 */
  prompts: string[]
  /** 当前显示索引，指向 prompts 或兜底列表中的某一条。 */
  currentIndex: number
}

/**
 * 从后端 PresenceEngine 拉取 Hermes 自生成的空闲问候语，
 * 并以不规则间隔轮播当前显示的索引，使空态中文字变化感觉自然。
 *
 * 拉取逻辑：挂载时立即 fetch，之后每 60 秒刷新一次。失败时静默忽略——
 * 掉网或后端未就绪时不阻塞空态渲染，由调用方回退到兜底文案。
 *
 * 轮播逻辑：使用递归 setTimeout（而非 setInterval），每次延迟在
 * 8~15 秒间随机，避免固定的机械节奏。
 *
 * @returns prompts 数组和当前轮播索引
 */
export function useIdlePrompts(): UseIdlePromptsResult {
  const [prompts, setPrompts] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const rotateTimerRef = useRef<number>(0)

  // ── 拉取：挂载 + 定期刷新 ──
  const fetchPrompts = useCallback(() => {
    fetch(`${BACKEND_HTTP}/api/presence/prompts`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<{ prompts: string[] }>
      })
      .then((data) => {
        if (data.prompts && data.prompts.length > 0) {
          setPrompts(data.prompts)
        }
      })
      .catch(() => {
        /* 拉取失败静默忽略，调用方使用兜底文案 */
      })
  }, [])

  useEffect(() => {
    fetchPrompts()
    const interval = window.setInterval(fetchPrompts, FETCH_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [fetchPrompts])

  // ── 轮播：不规则间隔前进索引 ──
  useEffect(() => {
    const list = prompts.length > 0 ? prompts : FALLBACK_PROMPTS
    if (list.length === 0) return

    /**
     * 递归调度下一次轮播：随机延迟后推进索引。
     */
    const scheduleNext = (): number => {
      const delay = ROTATE_MIN_MS + Math.random() * (ROTATE_MAX_MS - ROTATE_MIN_MS)
      return window.setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % list.length)
        rotateTimerRef.current = scheduleNext()
      }, delay)
    }

    // 重置索引（prompts 列表更新时从头开始）
    setCurrentIndex(0)
    // 清除旧定时器
    window.clearTimeout(rotateTimerRef.current)
    // 启动新轮播
    rotateTimerRef.current = scheduleNext()

    return () => window.clearTimeout(rotateTimerRef.current)
  }, [prompts])

  return { prompts, currentIndex }
}
