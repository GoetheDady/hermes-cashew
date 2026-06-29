# Hermes Desktop

Hermes Cashew is a personal desktop client for Hermes agent, created because the official Hermes desktop does not match the desired product feel or workflow. It should feel minimal, warm, and alive, with a cashew-inspired visual identity rather than a generic control-panel aesthetic.

## Language

**Cashew Desktop**:
The personal Hermes agent desktop client being built in this repository. It is an opinionated replacement experience, not a clone of the official Hermes desktop.
_Avoid_: official desktop clone, generic Hermes client

**Official Hermes Desktop**:
The existing Hermes-provided desktop application whose appearance and feature direction are intentionally not the product target for Cashew Desktop.
_Avoid_: upstream baseline, default UI

**Living Minimalism**:
The desired product feel: quiet, sparse, and low-friction, but still subtly alive rather than sterile.
_Avoid_: enterprise dashboard, feature-heavy console, decorative UI

**Cashew Palette**:
The visual color language for the app, based on warm cashew tones such as cream, pale gold, soft shell brown, and lightly roasted accents.
_Avoid_: cold tool palette, generic dark slate, saturated purple

**Gateway Reconnect**:
Re-establishing the renderer-to-backend WebSocket connection at `ws://localhost:8765/ws`. It does not mean restarting the watched Hermes dashboard process or exposing the dashboard token to the renderer.
_Avoid_: dashboard reconnect, process restart, token refresh

**Session History**:
A sidebar list of resumable conversation summaries returned by the Hermes gateway. It is not the full message transcript for a session.
_Avoid_: transcript, message log, chat archive

**Session Activity Time**:
The most recent time a Session History item was active, preferably from the latest message timestamp and falling back to the session start time when needed. It is the time shown in memory lists, not necessarily when the session was created.
_Avoid_: creation time, start label, message count

**Session History Sidebar**:
The persistent side-by-side form of Session History. It is opened by an explicit user click and may reduce the chat canvas width while it remains open.
_Avoid_: temporary drawer, hover preview, overlay history

**Session History Drawer**:
The temporary overlay form of Session History. It does not change the chat canvas width; it appears for narrow-window access or when a large-window user has manually closed the sidebar and hovers the left edge, then closes after leaving or completing a history selection.
_Avoid_: persistent sidebar, layout column, full navigation page

**Traffic Light Avoidance Zone**:
The small top-left rectangle reserved for macOS window controls when the native titlebar is hidden. It protects only the traffic-light buttons instead of pushing the whole app content downward.
_Avoid_: full titlebar gutter, global top padding

**Window Drag Region**:
The non-interactive window background that can drag the frameless desktop window. It must not cover buttons, inputs, or other controls, and it must not steal clicks from the Traffic Light Avoidance Zone.
_Avoid_: draggable controls, full-surface drag layer
