/** 窄窗口断点：低于该宽度时，Session History 点击打开为 Drawer。 */
export const SESSION_HISTORY_NARROW_BREAKPOINT = 900

/** Session History hover trigger 的 Tailwind 宽度类；`w-3` 等于 12px。 */
export const SESSION_HISTORY_HOVER_TRIGGER_CLASS = 'w-3'

/** hover 触发 Drawer 的打开延迟，避免鼠标路过左边缘时误触。 */
export const SESSION_HISTORY_DRAWER_OPEN_DELAY_MS = 150

/** hover Drawer 的关闭延迟，让离开时收起干净但不突兀。 */
export const SESSION_HISTORY_DRAWER_CLOSE_DELAY_MS = 100

/** Session History 的两种页面形态。 */
export type SessionHistorySurface = 'sidebar' | 'drawer'

export interface SessionHistoryHoverTriggerInput {
  /** 当前窗口宽度，单位 px。 */
  viewportWidth: number
  /** 用户是否已经手动收起过大窗口 Sidebar。 */
  hasSidebarBeenManuallyClosed: boolean
  /** 持久并排 Sidebar 当前是否打开。 */
  isSidebarOpen: boolean
}

/**
 * 根据窗口宽度决定点击“会话历史”时打开哪种 Session History 形态。
 *
 * @param viewportWidth - 当前窗口宽度，单位 px
 * @returns 窄窗口返回 Drawer，大窗口返回 Sidebar
 */
export function getSessionHistoryClickSurface(viewportWidth: number): SessionHistorySurface {
  return viewportWidth < SESSION_HISTORY_NARROW_BREAKPOINT ? 'drawer' : 'sidebar'
}

/**
 * 判断左侧 hover trigger 是否可以唤出临时 Session History Drawer。
 *
 * @param input - 当前窗口宽度、Sidebar 手动收起状态和 Sidebar 打开状态
 * @returns 只有大窗口、Sidebar 已手动收起且当前未打开时返回 true
 */
export function canUseSessionHistoryHoverTrigger({
  viewportWidth,
  hasSidebarBeenManuallyClosed,
  isSidebarOpen
}: SessionHistoryHoverTriggerInput): boolean {
  return (
    viewportWidth >= SESSION_HISTORY_NARROW_BREAKPOINT &&
    hasSidebarBeenManuallyClosed &&
    !isSidebarOpen
  )
}
