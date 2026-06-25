import type { ChatMessage } from '@hermes/shared'
import { Streamdown } from 'streamdown'
import { cn } from '@/lib/utils'
import { ThinkingBlock } from './thinking-block'
import { ToolCallBlock } from './tool-call-block'

/**
 * 单条消息气泡。user 右对齐，assistant 左对齐。
 * assistant 消息按 parts 原顺序展示 reasoning、tool-call 与正文。
 */
interface MessageBubbleProps {
  message: ChatMessage
  /** 当前是否在流式接收中（仅对最后一条 assistant 生效）。 */
  isStreaming: boolean
  /** 思考开始时间戳，用于计算耗时（仅对最后一条 assistant 生效）。 */
  thinkingStartedAt: number | null
}

export function MessageBubble({
  message,
  isStreaming,
  thinkingStartedAt
}: MessageBubbleProps): React.JSX.Element {
  const isUser = message.role === 'user'

  return (
    <div className="flex justify-start">
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
                return part.text ? (
                  <Streamdown key={index} isAnimating={isStreaming}>
                    {part.text}
                  </Streamdown>
                ) : null
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
          <span className="text-muted-foreground/50">…</span>
        ) : null}
      </div>
    </div>
  )
}
