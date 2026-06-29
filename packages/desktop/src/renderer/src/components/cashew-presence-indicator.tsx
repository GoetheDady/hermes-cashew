import { motion } from 'motion/react'
import type { CashewPresenceState } from '@/lib/cashew-presence'

export interface CashewPresenceIndicatorProps {
  /** 由 getCashewPresence 压缩出的当前 presence 状态。 */
  presence: CashewPresenceState
  /** 用户是否启用了减少动效；为真时关闭呼吸动画。 */
  reducedMotion: boolean | null
}

/**
 * 展示 Cashew Presence 的小型状态胶囊：一个呼吸圆点 + 短文案。
 *
 * 抽成共享组件便于聊天页与设置页复用同一套视觉语言，避免两处各自
 * 重写圆点/语气映射导致漂移。语气色由 presence.tone 决定，不暴露
 * 底层连接细节。
 *
 * @param props - presence 状态与 reduced-motion 偏好
 * @returns 顶部状态提示元素
 */
export function CashewPresenceIndicator({
  presence,
  reducedMotion
}: CashewPresenceIndicatorProps): React.JSX.Element {
  const toneClass = {
    warm: 'bg-primary/12 text-foreground',
    muted: 'bg-muted text-muted-foreground',
    active: 'bg-accent/75 text-accent-foreground',
    danger: 'bg-destructive/12 text-destructive'
  }[presence.tone]

  return (
    <span
      className={`app-no-drag inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs ${toneClass}`}
      aria-label={`Cashew Presence: ${presence.label}`}
    >
      <motion.span
        className="size-1.5 rounded-full bg-current"
        animate={
          presence.breathes && !reducedMotion
            ? { opacity: [0.45, 1, 0.45], scale: [1, 1.22, 1] }
            : undefined
        }
        transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      />
      {presence.label}
    </span>
  )
}
