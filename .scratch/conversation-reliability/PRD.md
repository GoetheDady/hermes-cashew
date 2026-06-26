# PRD: Conversation Reliability

Status: 可交付-agent

## Problem Statement

Hermes Desktop 已经转向「打开即新对话」的极简产品形态。这个方向让第一屏更直观，但也把所有用户信任集中到了唯一的对话入口上：如果连接中、后端不可用、Hermes dashboard 启动失败、`session.create` 失败或发送失败，用户没有侧栏、设置页或管理界面作为退路。

用户需要的不是更多首屏功能，而是一个可靠、可理解、可恢复的对话入口。正常情况下，界面应继续保持安静；异常情况下，界面要用很少的文字告诉用户当前处于哪个失败阶段，以及下一步能做什么。

当前风险是：不同失败来源可能都表现为「不能发送」或一条泛化错误。用户无法判断是还在连接、本地 backend 没起来、Hermes dashboard 没准备好、当前新对话创建失败，还是消息发送失败。这会削弱「打开就能聊」这个产品承诺。

## Solution

为极简对话入口增加轻量可靠性与诊断体验：

- 保持首屏只展示当前对话、输入框和必要异常恢复。
- 正常状态下不展示诊断面板、Session History、设置、模型选择或 reasoning 控制。
- 将对话入口的生命周期分为清晰状态：连接中、网关已连接但新对话创建中、可发送、发送中、连接断开、创建对话失败、发送失败。
- 对每类异常提供短文本说明和最小恢复动作。
- Gateway Reconnect 只用于重新建立 renderer 到 backend 的 WebSocket 连接，文案不能暗示重启 dashboard、刷新 token 或重置 Hermes。
- `session.create` 失败时提供「重试开启」一类动作，不要求用户理解 session lifecycle。
- 发送失败时保留当前输入或让用户能重新发送，不让用户丢失刚写的任务。
- 如果可以用现有 `/api/health` 判断 backend 可达，则在连接失败时优先把错误区分为「本地后端不可用」和「网关连接异常」。
- 如果 dashboard 启动失败只能通过 backend 失败表现出来，先用用户可理解的本地 Hermes 不可用文案兜底，不扩大为完整诊断页。

产品原则：

The conversation stays quiet when healthy, and becomes specific only when recovery is needed.

## User Stories

1. As a Hermes Desktop user, I want the app to clearly show when it is connecting, so that I know the conversation is not ready yet.
2. As a Hermes Desktop user, I want the app to clearly show when a new conversation is being opened, so that I understand why the input is temporarily disabled.
3. As a Hermes Desktop user, I want the input to become available as soon as the new conversation is ready, so that the app feels responsive.
4. As a Hermes Desktop user, I want normal healthy state to stay visually quiet, so that the conversation remains the center of attention.
5. As a Hermes Desktop user, I want a clear message when the local gateway connection is lost, so that I know this is a connection problem rather than my prompt.
6. As a Hermes Desktop user, I want Gateway Reconnect to be available only when the WebSocket connection is closed or errored, so that the recovery action matches the problem.
7. As a Hermes Desktop user, I want Gateway Reconnect wording to be precise, so that I do not think Hermes dashboard is being restarted.
8. As a Hermes Desktop user, I want the app to tell me when the local backend is unavailable, so that I know I need the backend process running.
9. As a Hermes Desktop user, I want the app to tell me when the new conversation could not be created, so that I know the connection may be alive but the session is not ready.
10. As a Hermes Desktop user, I want a retry action when new conversation creation fails, so that I can recover without restarting the app.
11. As a Hermes Desktop user, I want a failed retry to keep showing a useful error, so that I do not end up in a silent disabled state.
12. As a Hermes Desktop user, I want the app to preserve my typed prompt when sending fails before submission succeeds, so that I do not lose work.
13. As a Hermes Desktop user, I want send failures to be shown near the input, so that I understand the failure is connected to my current action.
14. As a Hermes Desktop user, I want the send button to clearly disable while a response is streaming, so that I do not accidentally start overlapping turns.
15. As a Hermes Desktop user, I want the send button to clearly disable before a session exists, so that I do not submit into an invalid state.
16. As a Hermes Desktop user, I want connection recovery not to erase visible conversation content unless a new session is explicitly created, so that I do not lose context unexpectedly.
17. As a Hermes Desktop user, I want a successful reconnect to proceed toward a usable new conversation automatically, so that recovery feels smooth.
18. As a Hermes Desktop user, I want the empty state to remain short and conversational, so that the product does not become a diagnostic console.
19. As a Hermes Desktop user, I do not want Session History to reappear as part of reliability work, so that the first-screen product remains simple.
20. As a Hermes Desktop user, I do not want settings or model controls to reappear as part of reliability work, so that troubleshooting does not pollute the main path.
21. As a Hermes Desktop user, I want errors to avoid internal protocol language like JSON-RPC, token, or upstream frame, so that I can act without knowing implementation details.
22. As a Hermes Desktop user, I want detailed implementation errors to remain available in developer logs, so that maintainers can still debug real failures.
23. As a Hermes Desktop user, I want the app to recover from transient disconnects without showing stale ready state, so that the UI never says I can send when I cannot.
24. As a Hermes Desktop user, I want the placeholder text to reflect the current readiness state, so that the input communicates what is happening.
25. As a Hermes Desktop maintainer, I want connection state, session-start state, and send state to be represented separately, so that future fixes do not collapse distinct failures into one bucket.
26. As a Hermes Desktop maintainer, I want a high-level test to prove the first screen stays conversation-only in success and failure states, so that reliability work does not reintroduce management UI.
27. As a Hermes Desktop maintainer, I want a high-level test to prove Gateway Reconnect only appears for gateway connection failures, so that the domain term stays precise.
28. As a Hermes Desktop maintainer, I want a high-level test to prove session creation failure shows retry without exposing Session History or settings, so that the current product direction remains protected.
29. As a Hermes Desktop maintainer, I want a high-level test to prove send failure is visible and recoverable, so that users do not lose prompts silently.
30. As a Hermes Desktop maintainer, I want backend health checks to stay optional and thin, so that diagnosis does not turn into a new product surface.
31. As a Hermes Desktop maintainer, I want dashboard token ownership unchanged, so that reliability work does not weaken the renderer/backend security boundary.
32. As a Hermes Desktop maintainer, I want the renderer to continue talking only to the local gateway proxy, so that the architecture remains aligned with Hermes Desktop's core safety model.

## Implementation Decisions

- The feature improves the existing single-conversation product surface rather than adding a new diagnostics page.
- Keep the visible first screen limited to transcript, empty state, input, send button, and minimal exception recovery.
- Model the conversation page around distinct states: gateway connection, session creation, active session availability, streaming/send, and user-visible errors.
- Gateway Reconnect remains scoped to renderer-to-backend WebSocket reconnection at `ws://localhost:8765/ws`.
- Do not use Gateway Reconnect wording for restarting the watched Hermes dashboard process.
- Do not expose the dashboard token, upstream dashboard URL, JSON-RPC frame details, or internal process supervision details in the renderer.
- Use existing gateway connection state as the primary readiness signal for the renderer.
- Use `session.create` result as the source of truth for whether the current new conversation can accept prompts.
- If a backend health probe is added, keep it as a thin user-facing classification helper for connection failures.
- A failed backend health check should surface as local Hermes/backend unavailable, not as a token or dashboard implementation detail.
- A failed `session.create` should surface as new conversation creation failure with a retry action.
- A failed prompt submission should surface as send failure and preserve user recovery.
- Do not fetch or render Session History for reliability purposes.
- Do not reintroduce model options or reasoning configuration to the main screen.
- Do not add new navigation or settings routes as part of this PRD.
- Keep stream, thinking, reasoning, and tool-call rendering behavior unchanged when the conversation is healthy.
- Keep the Node backend as the owner of dashboard credentials.
- Keep logs useful for maintainers, but keep user-facing errors short and actionable.

## Testing Decisions

- The primary testing seam is the single conversation page's external behavior under controlled gateway and request outcomes.
- Tests should assert user-visible behavior: visible text, enabled/disabled input, visible retry actions, and absence of first-screen management UI.
- Tests should not assert private hook state or internal implementation details.
- A good test drives the page from connecting to ready and verifies that the user sees a conversation-first empty state and enabled input after `session.create` succeeds.
- A good test drives a WebSocket closed/error state and verifies that Gateway Reconnect is visible and no Session History/settings/model/reasoning UI appears.
- A good test drives `session.create` failure and verifies that the page shows a new-conversation retry action, not Gateway Reconnect unless the connection itself failed.
- A good test drives prompt submission failure and verifies that the failure is visible near the conversation input and recoverable.
- A good test verifies that healthy ready state does not show persistent diagnostic chrome.
- A good test verifies that typed user input is not lost when a send attempt fails before the message is accepted.
- If backend health classification is implemented, test the health probe through its public request wrapper or route contract rather than by mocking internals.
- Existing shared-package tests for message/tool normalization remain useful regression coverage, but they are not the primary seam for this feature.
- Existing TypeScript checks and Electron build remain required verification for implementation.
- Manual verification should run backend and desktop together, test normal send, stop/restart backend, trigger Gateway Reconnect, and trigger or simulate session creation failure.

## Out of Scope

- Reintroducing Session History to the first screen.
- Adding history search, history restore, session rename, delete, pin, branch, undo, interrupt, or compress controls.
- Adding a settings page or moving reliability work into settings.
- Adding model selection or reasoning selection to the main conversation UI.
- Building a full diagnostics dashboard.
- Restarting or supervising dashboard from renderer UI.
- Changing how Hermes dashboard is started by the backend.
- Changing the dashboard token ownership model.
- Exposing dashboard token or dashboard URL to the renderer.
- Changing the JSON-RPC gateway protocol.
- Adding cloud sync, accounts, remote sessions, or multi-workspace support.
- Solving every possible Hermes installation problem with guided setup.

## Further Notes

- This PRD follows the previous `open-to-conversation` PRD: the product stays conversation-first.
- The domain term Gateway Reconnect must remain precise: it means re-establishing the renderer-to-backend WebSocket connection at `ws://localhost:8765/ws`.
- Session History remains a domain concept for resumable conversation summaries, but it is not part of this reliability-focused first-screen work.
- Reliability work should make the one visible path feel trustworthy, not add more paths.
