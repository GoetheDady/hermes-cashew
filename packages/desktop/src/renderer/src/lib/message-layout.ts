import type { ChatMessage } from '@hermes/shared'

/**
 * 返回单条消息行的横向对齐 class。
 *
 * @param role - 当前消息角色
 * @returns user 消息靠右，其他消息靠左
 */
export function getMessageBubbleRowClass(role: ChatMessage['role']): string {
  return role === 'user' ? 'flex justify-end' : 'flex justify-start'
}
