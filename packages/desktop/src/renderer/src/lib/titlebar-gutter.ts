/** macOS traffic-light controls need a real top gutter when the native titlebar is hidden. */
export const MAC_TRAFFIC_LIGHT_GUTTER_PX = 35

/**
 * 返回根布局应预留的顶部窗口控制区高度。
 *
 * @returns 顶部 gutter 高度，单位 px
 */
export function getTitlebarGutterPx(): number {
  return MAC_TRAFFIC_LIGHT_GUTTER_PX
}
