/**
 * Session History 根侧栏的布局类。
 *
 * 该类会被 Sidebar 和 Drawer 的动画容器包裹，必须自己声明高度，
 * 不能依赖父级 flex stretch。
 */
export const SESSION_SIDEBAR_CLASS =
  'app-no-drag flex h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar pt-8 text-sidebar-foreground'
