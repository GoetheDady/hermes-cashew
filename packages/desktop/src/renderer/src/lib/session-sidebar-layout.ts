/**
 * Session History 根侧栏的布局类。
 *
 * 该类会被 Sidebar 和 Drawer 的动画容器包裹，必须自己声明高度，
 * 不能依赖父级 flex stretch。
 */
export const SESSION_SIDEBAR_CLASS =
  'app-no-drag flex h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar pt-8 text-sidebar-foreground'

/** Session History 条目的基础布局类：偏列表感，不做默认卡片边框。 */
const SESSION_HISTORY_ITEM_BASE_CLASS =
  'h-auto min-h-14 w-full items-start justify-start whitespace-normal rounded-md border-0 px-2.5 py-2 text-left shadow-none hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground'

/** 当前选中会话的克制暖色底。 */
const SESSION_HISTORY_ITEM_ACTIVE_CLASS = 'bg-sidebar-accent/80 text-sidebar-accent-foreground'

/** 普通会话保持透明背景，避免侧栏显得像卡片堆叠。 */
const SESSION_HISTORY_ITEM_INACTIVE_CLASS = 'bg-transparent text-sidebar-foreground'

/**
 * 返回 Session History 条目的列表式布局类。
 *
 * @param isActive - 当前条目是否为正在查看的会话
 * @returns 普通项透明，选中项使用暖色底的 className
 */
export function getSessionHistoryItemClass(isActive: boolean): string {
  return [
    SESSION_HISTORY_ITEM_BASE_CLASS,
    isActive ? SESSION_HISTORY_ITEM_ACTIVE_CLASS : SESSION_HISTORY_ITEM_INACTIVE_CLASS
  ].join(' ')
}
