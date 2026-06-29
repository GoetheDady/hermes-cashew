import type { ChatMessage } from '@hermes/shared'
import { Streamdown } from 'streamdown'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { ThinkingBlock } from './thinking-block'
import { ToolCallBlock } from './tool-call-block'

/** 轻量消息进入动画：只做低幅度透明度/位移，避免打扰阅读。 */
const messageEnterTransition = { duration: 0.3, ease: 'easeOut' } as const

/**
 * 单条消息气泡。所有消息一律左对齐，角色之间靠气泡配色区分。
 * assistant 消息按 parts 原顺序展示 reasoning、tool-call 与正文。
 */
interface MessageBubbleProps {
  message: ChatMessage
  /** 当前是否在流式接收中（仅对最后一条 assistant 生效）。 */
  isStreaming: boolean
  /** 思考开始时间戳，用于计算耗时（仅对最后一条 assistant 生效）。 */
  thinkingStartedAt: number | null
  /** 是否播放新消息入场动画；历史和回放消息应即时显示。 */
  animateEntry?: boolean
  /** 新消息逐条出现时的稳定延迟，单位为秒。 */
  entryDelay?: number
}

/**
 * 渲染单条对话消息，并按调用方声明决定是否播放入场动画。
 *
 * @param props - 消息内容、流式状态和入场动画控制项
 * @returns 单条消息气泡元素
 */
export function MessageBubble({
  message,
  isStreaming,
  thinkingStartedAt,
  animateEntry = true,
  entryDelay = 0
}: MessageBubbleProps): React.JSX.Element {
  const isUser = message.role === 'user'
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      className="flex justify-start"
      initial={reducedMotion || !animateEntry ? false : { opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...messageEnterTransition, delay: animateEntry ? entryDelay : 0 }}
      layout={!reducedMotion}
    >
      <div
        className={cn(
          'max-w-full rounded-2xl px-3 py-1.5 text-sm',
          'streamdown-bubble',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'border border-border bg-card text-card-foreground'
        )}
      >
        {/* 按 parts 原顺序显示，避免 reasoning/tool/text 被合并或挪位。 */}
        {message.parts.length > 0 ? (
          <div className="space-y-1">
            {message.parts.map((part, index) => {
              if (part.type === 'text') {
                if (!part.text) return null
                return isUser ? (
                  <div key={index} className="whitespace-pre-wrap break-words">
                    {part.text}
                  </div>
                ) : (
                  <Streamdown key={index} isAnimating={isStreaming}>
                    {part.text}
                  </Streamdown>
                )
              }

              if (part.type === 'reasoning') {
                return !isUser ? (
                  <ThinkingBlock
                    key={index}
                    text={part.text}
                    isStreaming={isStreaming}
                    startedAt={thinkingStartedAt}
                  />
                ) : null
              }

              return <ToolCallBlock key={part.toolCallId || index} part={part} />
            })}
          </div>
        ) : isStreaming ? (
          <motion.span
            className="inline-block text-muted-foreground/50"
            animate={reducedMotion ? undefined : { opacity: [0.35, 0.8, 0.35] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            …
          </motion.span>
        ) : null}
      </div>
    </motion.div>
  )
}
