import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

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

export function ThinkingBlock({ text, isStreaming, startedAt }: ThinkingBlockProps) {
  const [open, setOpen] = useState(true)
  const [durationMs, setDurationMs] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 流式结束后关闭计时器，锁定耗时
  useEffect(() => {
    if (!startedAt) return undefined

    if (isStreaming) {
      setDurationMs(Date.now() - startedAt)
      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startedAt)
      }, 100)
      return () => {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    } else {
      setDurationMs(Date.now() - startedAt)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return undefined
    }
  }, [isStreaming, startedAt])

  // 完成后自动折叠
  useEffect(() => {
    if (!isStreaming && text) {
      setOpen(false)
    }
  }, [isStreaming, text])

  if (!text) return null

  const hasDuration = startedAt != null
  const label = hasDuration ? `思考中 (${formatDuration(durationMs)})` : '思考中'

  return (
    <div className="my-2">
      <button
        type="button"
        className={cn(
          'flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors cursor-pointer select-none',
          'py-0.5'
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-[0.6rem] leading-none">{open ? '▼' : '▶'}</span>
        <span>{label}</span>
      </button>

      {open && (
        <div className="mt-1 pl-4 border-l-2 border-muted">
          <div className="text-xs text-muted-foreground/80 whitespace-pre-wrap leading-relaxed">
            {text}
          </div>
        </div>
      )}
    </div>
  )
}
