/**
 * Session History 根侧栏的布局类。
 *
 * 该类会被 Sidebar 和 Drawer 的动画容器包裹，必须自己声明高度，
 * 不能依赖父级 flex stretch。沉井语言：不用 border-r 硬边，靠
 * `--sidebar` 比主区深一档的色调台阶分层；`session-sidebar-surface`
 * 在底色上叠一道极轻暖色竖向渐变补温暖感。
 */
export const SESSION_SIDEBAR_CLASS =
  'app-no-drag flex h-full w-72 shrink-0 flex-col bg-sidebar session-sidebar-surface pt-8 text-sidebar-foreground'

/** Session History 条目的基础布局类：偏列表感，不做默认卡片边框；relative 供左竖条定位。 */
const SESSION_HISTORY_ITEM_BASE_CLASS =
  'relative h-auto min-h-13 w-full items-start justify-start whitespace-normal rounded-md border-0 px-2.5 py-2 text-left shadow-none'

/** 当前选中会话：蜂蜜金满底 + 字重加重；hover 时维持满底略加深，避免选中态被悬停冲淡。 */
const SESSION_HISTORY_ITEM_ACTIVE_CLASS =
  'bg-sidebar-accent/85 hover:bg-sidebar-accent/90 text-sidebar-accent-foreground font-semibold'

/** 普通会话保持透明背景，避免侧栏显得像卡片堆叠；悬停仅淡暖色冲洗，与选中态明确区分。 */
const SESSION_HISTORY_ITEM_INACTIVE_CLASS =
  'bg-transparent hover:bg-sidebar-accent/45 hover:text-sidebar-accent-foreground text-sidebar-foreground font-medium'

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
