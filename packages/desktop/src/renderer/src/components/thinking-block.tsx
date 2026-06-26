import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

/** thinking 块进入/展开的低幅度过渡，保持内容阅读稳定。 */
const thinkingTransition = { duration: 0.22, ease: 'easeOut' } as const

/**
 * 可折叠思考块，显示在 assistant 回复正文上方。
 *
 * - 流式传输时（`isStreaming`）自动展开，完成后可点击折叠/展开。
 * - 耗时从 `startedAt` 开始实时计算，流式结束后锁定为最终值。
 */
interface ThinkingBlockProps {
  text: string
  isStreaming: boolean
  startedAt: number | null
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`
}

export function ThinkingBlock({
  text,
  isStreaming,
  startedAt
}: ThinkingBlockProps): React.ReactNode {
  const [open, setOpen] = useState(true)
  const [durationMs, setDurationMs] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reducedMotion = useReducedMotion()

  // 流式结束后关闭计时器，锁定耗时
  // 使用 rAF 包装同步 setState 以避免 react-hooks/set-state-in-effect
  useEffect(() => {
    if (!startedAt) return undefined

    if (isStreaming) {
      const rafId = requestAnimationFrame(() => {
        setDurationMs(Date.now() - startedAt)
      })
      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startedAt)
      }, 100)
      return () => {
        cancelAnimationFrame(rafId)
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }
    // 流式结束时锁定最终耗时
    const rafId = requestAnimationFrame(() => {
      setDurationMs(Date.now() - startedAt)
    })
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [isStreaming, startedAt])

  // 完成后自动折叠
  useEffect(() => {
    if (!isStreaming && text) {
      const rafId = requestAnimationFrame(() => {
        setOpen(false)
      })
      return () => cancelAnimationFrame(rafId)
    }
    return undefined
  }, [isStreaming, text])

  const handleToggle = useCallback(() => {
    setOpen((v) => !v)
  }, [])

  if (!text) return null

  const hasDuration = startedAt != null
  const label = hasDuration ? `思考中 (${formatDuration(durationMs)})` : '思考中'

  return (
    <motion.div
      className="my-2"
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={thinkingTransition}
    >
      <button
        type="button"
        className={cn(
          'flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors cursor-pointer select-none',
          'py-0.5'
        )}
        onClick={handleToggle}
      >
        <span className="text-[0.6rem] leading-none">{open ? '▼' : '▶'}</span>
        <span>{label}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="mt-1 border-l-2 border-muted pl-4"
            initial={reducedMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={thinkingTransition}
          >
            <div className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground/80">
              {text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
