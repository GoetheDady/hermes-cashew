import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'

/** 页面级微动效参数：短、轻、低位移。 */
const softTransition = { duration: 0.22, ease: 'easeOut' } as const

/**
 * 根据当前系统小时返回中文时间问候语。
 *
 * @returns 如 "早上好"、"下午好"、"夜深了，我还在。"
 */
function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 12) return '早上好'
  if (hour >= 12 && hour < 14) return '中午好'
  if (hour >= 14 && hour < 18) return '下午好'
  if (hour >= 18 && hour < 23) return '晚上好'
  return '夜深了，我还在。'
}

/**
 * 时间感知问候 hook：返回当前时间段的问候语，每 60 秒检查是否跨小时边界。
 *
 * @returns 当前应显示的问候语
 */
function useTimeGreeting(): string {
  const [greeting, setGreeting] = useState(getTimeGreeting)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setGreeting(getTimeGreeting())
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  return greeting
}

/**
 * 有机呼吸光晕：两个嵌套 motion.span，以不同频率脉冲产生永不精确重复的节律。
 *
 * 内层 1.4s 周期，外层 2.3s 周期——频率比为 ~1.64，非简单有理数比例，
 * 叠加后的视觉模式约 32 秒才完整循环一次，远超用户的注意周期。
 *
 * @param variant - "muted" 用于连接中/会话创建中，"primary" 用于就绪空闲态
 */
function BreathingGlow({
  variant,
  reducedMotion
}: {
  variant: 'muted' | 'primary'
  reducedMotion: boolean | null
}): React.JSX.Element {
  if (reducedMotion) {
    return (
      <span
        className={
          variant === 'primary'
            ? 'size-3 rounded-full bg-primary/55 shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_12%,transparent)]'
            : 'size-3 rounded-full bg-muted-foreground/60'
        }
        aria-hidden="true"
      />
    )
  }

  const isPrimary = variant === 'primary'

  return (
    <span className="relative inline-flex size-3 items-center justify-center" aria-hidden="true">
      {/* 外层光晕环：2.3s 周期，慢呼吸 */}
      <motion.span
        className="absolute inset-0 rounded-full"
        animate={
          isPrimary
            ? {
                opacity: [0.55, 0.95, 0.55],
                scale: [1, 1.14, 1],
                boxShadow: [
                  '0 0 0 3px color-mix(in oklch, var(--primary) 10%, transparent)',
                  '0 0 0 7px color-mix(in oklch, var(--primary) 16%, transparent)',
                  '0 0 0 3px color-mix(in oklch, var(--primary) 10%, transparent)'
                ]
              }
            : {
                opacity: [0.35, 0.9, 0.35],
                scale: [1, 1.16, 1]
              }
        }
        transition={{ duration: 2.3, repeat: Infinity, ease: 'easeInOut' }}
        style={
          isPrimary
            ? { backgroundColor: 'oklch(0.52 0.09 65 / 0.55)' }
            : { backgroundColor: 'oklch(0.5 0.03 62 / 0.6)' }
        }
      />

      {/* 内层核心圆点：1.4s 周期，快呼吸 */}
      <motion.span
        className="absolute inset-0 rounded-full"
        animate={
          isPrimary
            ? { opacity: [0.6, 1, 0.6], scale: [1, 1.1, 1] }
            : { opacity: [0.4, 0.85, 0.4], scale: [1, 1.12, 1] }
        }
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        style={
          isPrimary
            ? { backgroundColor: 'oklch(0.52 0.09 65 / 0.75)' }
            : { backgroundColor: 'oklch(0.5 0.03 62 / 0.7)' }
        }
      />
    </span>
  )
}

export interface EmptyConversationProps {
  /** 网关握手是否已完成。 */
  ready: boolean
  /** 提供时渲染「继续上次」按钮，点击恢复最近会话；省略则不显示。 */
  onContinueLast?: () => void
  /** 「继续上次」按钮的禁用态（如正在恢复会话时）。 */
  continueLastDisabled?: boolean
}

/**
 * 空对话占位：时间感知问候 + 有机呼吸光晕。
 *
 * 默认即 Fresh Conversation——用户直接打字即开启新对话（首条消息时才真正建会话）。
 * 仅当存在可继续的历史时，多出一个安静的「继续上次」按钮。
 *
 * @param ready - 网关握手是否已完成
 * @param onContinueLast - 恢复最近会话的回调
 * @param continueLastDisabled - 「继续上次」按钮是否禁用
 * @returns 空对话状态 React 元素
 */
export function EmptyConversation({
  ready,
  onContinueLast,
  continueLastDisabled
}: EmptyConversationProps): React.JSX.Element {
  const reducedMotion = useReducedMotion()
  const greeting = useTimeGreeting()

  const statusText = !ready ? '正在连接 Hermes…' : greeting
  const glowVariant: 'muted' | 'primary' = !ready ? 'muted' : 'primary'

  return (
    <motion.div
      className="flex flex-1 items-center justify-center py-16"
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={softTransition}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <BreathingGlow variant={glowVariant} reducedMotion={reducedMotion} />
        <span className="text-sm font-medium text-foreground">{statusText}</span>
        {onContinueLast && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={onContinueLast}
            disabled={continueLastDisabled}
          >
            继续上次
          </Button>
        )}
      </div>
    </motion.div>
  )
}
