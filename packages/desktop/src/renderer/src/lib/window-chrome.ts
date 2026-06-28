/** Traffic Light Avoidance Zone 使用 Tailwind 的 `w-24 h-9` 尺寸。 */
export const TRAFFIC_LIGHT_AVOIDANCE_CLASS = 'w-24 h-9'

/** Window Drag Region 使用 Tailwind 的 `h-9` 高度，只覆盖顶部背景条。 */
export const WINDOW_DRAG_REGION_CLASS = 'h-9'

/**
 * 返回 Traffic Light 避让区的 Tailwind 尺寸类。
 *
 * @returns 左上角 macOS 三个窗口按钮的避让尺寸类
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
