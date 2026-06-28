import { Outlet } from 'react-router-dom'
import { getTitlebarGutterPx } from '@/lib/titlebar-gutter'

/**
 * 应用根布局：提供透明拖拽条 + 子路由渲染出口。
 *
 * 拖拽条用于 macOS 无原生标题栏时拖动窗口，所有页面共享。
 * 各页面通过 `<Outlet />` 渲染，负责各自的内部布局（侧栏、内容区等）。
 */
export function Layout(): React.JSX.Element {
  const titlebarGutterPx = getTitlebarGutterPx()

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* 透明拖拽条：macOS 无原生标题栏时用于拖动窗口 */}
      <div
        className="shrink-0"
        style={
          {
            height: titlebarGutterPx,
            WebkitAppRegion: 'drag'
          } as React.CSSProperties
        }
      />
      <div className="flex min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
