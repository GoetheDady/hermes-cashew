import { useEffect, useState } from 'react'

/** 午夜氛围时段的判断边界：0 点起、5 点（含）止。 */
const MIDNIGHT_START_HOUR = 0
const MIDNIGHT_END_HOUR = 5

/**
 * 当前本地时间是否处于午夜氛围时段（0–5 点）。
 *
 * 抽成独立纯函数便于跨页复用与单测：聊天页的呼吸节奏、设置页的色温
 * 都依赖同一套判定，避免两处各自 `new Date().getHours()` 漂移。
 *
 * @param now - 可注入的当前时间，省略时取系统当前时间
 * @returns 落在 0–5 点区间返回 true，其余返回 false
 */
export function isMidnightHour(now: Date = new Date()): boolean {
  const hour = now.getHours()
  return hour >= MIDNIGHT_START_HOUR && hour <= MIDNIGHT_END_HOUR
}

/**
 * 订阅午夜氛围时段的变更，跨分钟自动切换。
 *
 * 60 秒轮询足够：色温切换只需分钟级精度，更短的间隔只会无谓增加
 * 重渲染。卸载时清理定时器，避免 setState 到已卸载组件。
 *
 * @returns 当前是否处于午夜氛围时段
 */
export function useMidnightHour(): boolean {
  const [isMidnight, setIsMidnight] = useState<boolean>(() => isMidnightHour())

  useEffect(() => {
    const updateMidnight = (): void => setIsMidnight(isMidnightHour())
    updateMidnight()
    const interval = window.setInterval(updateMidnight, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  return isMidnight
}
