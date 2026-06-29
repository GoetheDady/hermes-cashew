/**
 * Traffic Light 避让区与顶部控件行共享的左上避让宽度(像素)。
 *
 * 三个 macOS 窗口按钮实际约占左上 18px→70px,80px 在贴齐按钮的同时保留
 * 约 10px 安全余量。避让 `width` 与控件行 `left` 都通过 inline style
 * 注入此值,作为单一来源,避免 Tailwind 字面量类在两处分别手改。
 */
export const TRAFFIC_LIGHT_INSET_PX = 80

/**
 * Traffic Light 避让区:不可见、不拦截点击,只占左上角。
 * 宽度由 inline style 注入 `TRAFFIC_LIGHT_INSET_PX`,高度与顶部拖拽条一致为 `h-9`。
 */
export const TRAFFIC_LIGHT_AVOIDANCE_CLASS =
  'pointer-events-none absolute left-0 top-0 z-50 h-9'

/** Window Drag Region 使用 Tailwind 的 `h-9` 高度,只覆盖顶部背景条。 */
export const WINDOW_DRAG_REGION_CLASS = 'h-9'

/**
 * 顶部控件行固定在窗口顶部,左侧从 Traffic Light 避让宽度右侧开始排布。
 * `left` 由 inline style 注入 `TRAFFIC_LIGHT_INSET_PX`,右侧贴窗口右缘。
 */
export const TOP_CONTROLS_ROW_CLASS =
  'app-drag absolute right-0 top-0 z-50 flex h-9 items-center justify-between px-3'

/**
 * 返回 Traffic Light 避让宽度(像素)。
 *
 * @returns 左上角 macOS 三个窗口按钮的避让宽度
 */
export function getTrafficLightInsetPx(): number {
  return TRAFFIC_LIGHT_INSET_PX
}

/**
 * 返回 Traffic Light 避让区的 Tailwind 类(宽度由 inline style 注入)。
 *
 * @returns 左上角 macOS 三个窗口按钮的避让区 className
 */
export function getTrafficLightAvoidanceClass(): string {
  return TRAFFIC_LIGHT_AVOIDANCE_CLASS
}

/**
 * 返回 Window Drag Region 的 Tailwind 高度类。
 *
 * @returns 顶部可拖拽背景条的高度类
 */
export function getWindowDragRegionClass(): string {
  return WINDOW_DRAG_REGION_CLASS
}

/**
 * 返回顶部控件行的布局类(左侧定位由 inline style 注入)。
 *
 * @returns 顶部控件行 className
 */
export function getTopControlsRowClass(): string {
  return TOP_CONTROLS_ROW_CLASS
}
