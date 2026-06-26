import type { ToolCallPart } from '@hermes/shared'
import { AlertTriangle, CheckCircle2, ChevronDown, LoaderCircle, Wrench } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

/** tool call 块进入动画：轻微出现即可，避免像日志面板一样突兀。 */
const toolCallTransition = { duration: 0.22, ease: 'easeOut' } as const

/**
 * 把未知值格式化为工具详情文本。
 *
 * @param value - 工具参数或结果
 * @returns 可读文本；空值返回空字符串
 */
function formatUnknown(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/**
 * 格式化工具耗时。
 *
 * @param seconds - 秒数
 * @returns 简短耗时标签
 */
function formatDuration(seconds: number | undefined): string {
  if (seconds == null) return ''
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`
}

/**
 * 工具调用展示块：默认紧凑，失败或带 diff 时自动展开。
 *
 * @param props - 组件参数
 * @param props.part - 工具调用片段
 * @returns 工具调用的可展开 UI
 */
export function ToolCallBlock({ part }: { part: ToolCallPart }): React.JSX.Element {
  const reducedMotion = useReducedMotion()
  const isRunning = part.result === undefined
  const isError = Boolean(part.isError)
  const defaultOpen = isError || Boolean(part.inlineDiff)
  const detail = part.resultText || part.summary || formatUnknown(part.result)
  const argsText = part.argsText || formatUnknown(part.args)
  const duration = formatDuration(part.durationS)
  const subtitle = part.context || part.preview || part.summary || detail
  const statusLabel = isRunning ? '运行中' : isError ? '失败' : '完成'
  const StatusIcon = isRunning ? LoaderCircle : isError ? AlertTriangle : CheckCircle2

  return (
    <motion.details
      className={cn(
        'my-2 rounded-lg border bg-muted/30 text-xs',
        isError ? 'border-destructive/30 bg-destructive/5' : 'border-border'
      )}
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={toolCallTransition}
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-1.5 text-muted-foreground [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-3 shrink-0 transition-transform details-open:rotate-180" />
        <Wrench className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{part.toolName}</span>
        {subtitle && <span className="min-w-0 max-w-[45%] truncate">{subtitle}</span>}
        {duration && <span className="shrink-0 tabular-nums">{duration}</span>}
        <span
          className={cn('inline-flex shrink-0 items-center gap-1', isError && 'text-destructive')}
        >
          <StatusIcon className={cn('size-3', isRunning && 'animate-spin')} />
          {statusLabel}
        </span>
      </summary>

      <div className="space-y-2 border-t px-2.5 py-2">
        {argsText && (
          <section>
            <div className="mb-1 text-[0.68rem] font-medium text-muted-foreground">参数</div>
            <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded bg-background/70 p-2 font-mono text-[0.72rem] leading-relaxed">
              {argsText}
            </pre>
          </section>
        )}
        {part.inlineDiff && (
          <section>
            <div className="mb-1 text-[0.68rem] font-medium text-muted-foreground">Diff</div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-background/70 p-2 font-mono text-[0.72rem] leading-relaxed">
              {part.inlineDiff}
            </pre>
          </section>
        )}
        {detail && (
          <section>
            <div className="mb-1 text-[0.68rem] font-medium text-muted-foreground">
              {isError ? '错误' : '结果'}
            </div>
            <pre
              className={cn(
                'max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-background/70 p-2 font-mono text-[0.72rem] leading-relaxed',
                isError && 'text-destructive'
              )}
            >
              {detail}
            </pre>
          </section>
        )}
      </div>
    </motion.details>
  )
}
