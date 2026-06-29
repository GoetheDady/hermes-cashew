/**
 * Fresh Conversation（懒创建）相关纯判定。
 *
 * 见 docs/adr/0001-lazy-session-creation.md：进入或「新对话」只在渲染层持有空对话，
 * 直到首条消息发送才真正 `session.create`。此处集中可单测的可见性判定。
 */

/** Continue Last 按钮的可见性输入。 */
export interface ContinueLastVisibility {
  /** 网关握手是否已完成。 */
  ready: boolean
  /** 是否已有活动会话（已 create 或已 resume）。有则说明已离开空态，按钮应隐藏。 */
  hasActiveSession: boolean
  /** 是否正在恢复某个历史会话。 */
  isSessionLoading: boolean
  /** 是否已尝试加载过第一页会话列表。 */
  hasLoadedSessions: boolean
  /** 已加载的会话条数。 */
  sessionsCount: number
}

/**
 * 判断是否应在空对话区显示「继续上次」按钮。
 *
 * 仅当网关就绪、仍处于 Fresh Conversation 空态（无活动会话、未在恢复中）、
 * 且会话列表已加载并有至少一条可继续的历史时才显示。
 *
 * @param v - 可见性输入
 * @returns 是否显示 Continue Last 按钮
 */
export function shouldShowContinueLast(v: ContinueLastVisibility): boolean {
  return (
    v.ready &&
    !v.hasActiveSession &&
    !v.isSessionLoading &&
    v.hasLoadedSessions &&
    v.sessionsCount > 0
  )
}
