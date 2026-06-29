import { Outlet } from 'react-router-dom'
import {
  getTrafficLightAvoidanceClass,
  getTrafficLightInsetPx,
  getWindowDragRegionClass
} from '@/lib/window-chrome'

/**
 * 应用根布局：提供窗口拖拽背景、macOS 三点避让区和子路由渲染出口。
 *
 * 顶部背景条用于拖动窗口；左上角只保留 traffic-light 避让区，
 * 不再把整个页面内容整体下压。
 * 各页面通过 `<Outlet />` 渲染，负责各自的内部布局（侧栏、内容区等）。
 *
 * @returns 应用根布局元素
 */
export function Layout(): React.JSX.Element {
  const dragRegionClass = getWindowDragRegionClass()
  const avoidanceClass = getTrafficLightAvoidanceClass()
  const trafficLightInsetPx = getTrafficLightInsetPx()

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* 顶部透明拖拽条：只让窗口背景可拖拽，真实控件需要显式 no-drag。 */}
      <div
        className={`absolute inset-x-0 top-0 z-40 ${dragRegionClass}`}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />
      {/* macOS 三点避让区：只占左上角，不影响其余顶部内容。 */}
      <div
        className={avoidanceClass}
        style={{ width: trafficLightInsetPx }}
        aria-hidden="true"
      />
      <Outlet />
    </div>
  )
}
