# PRD: Open To Conversation

Status: 可交付-agent

## Problem Statement

Hermes Desktop 现在已经具备新建会话、Session History、模型选择、reasoning 强度、设置入口、Gateway Reconnect、工具调用展示等能力，但第一屏像一个工作台，而不是一个打开就能使用的对话入口。

用户希望产品变得更直接：打开应用后，唯一可见的核心能力就是开始新对话。用户不应该先处理历史、设置、模型、cron 过滤、dashboard 状态或其他管理概念。Hermes Desktop 的第一印象应当是「我可以马上和 Hermes 对话」，而不是「我需要先理解这个控制台」。

与此同时，Gateway Reconnect 和错误提示不能完全消失。因为当本地网关、后端代理或 Hermes dashboard 不可用时，用户需要知道为什么不能输入或发送，而不是误以为应用无响应。

## Solution

将 Hermes Desktop 的默认产品形态设计为一个极简本地对话入口：

- 打开应用后自动建立新的 Hermes 会话。
- 首屏只展示当前新对话的消息区和输入区。
- 正常状态下不展示 Session History、设置入口、模型选择、reasoning 选择、cron 过滤或会话管理。
- 输入框是视觉和交互焦点，连接完成后可立即输入。
- 连接中、连接失败、发送失败等异常状态以轻量提示出现。
- Gateway Reconnect 仍保留，但只在异常状态下通过最小交互暴露。
- dashboard token 继续只由 Node 后端持有，renderer 只连接本地 gateway proxy。

产品原则：

Open = New Conversation. Everything else is invisible until needed.

## User Stories

1. As a Hermes Desktop user, I want the app to open directly into a new conversation, so that I can start asking without choosing a mode.
2. As a Hermes Desktop user, I want the first screen to contain only the active conversation, so that I am not distracted by management UI.
3. As a Hermes Desktop user, I want the input box to be the obvious focus, so that I immediately know what to do.
4. As a Hermes Desktop user, I want the app to create a new Hermes session automatically, so that I do not need to understand session lifecycle.
5. As a Hermes Desktop user, I want to type a message as soon as the gateway is ready, so that the app feels fast and direct.
6. As a Hermes Desktop user, I want the input to be disabled only when the gateway is not ready, so that I do not lose confidence in the UI.
7. As a Hermes Desktop user, I want a small connecting state while Hermes is preparing, so that I understand why I cannot send yet.
8. As a Hermes Desktop user, I want a clear retry action when Gateway Reconnect is needed, so that I can recover from a broken local connection.
9. As a Hermes Desktop user, I want connection problems to be explained in plain language, so that I know whether Hermes is unavailable or the app is still connecting.
10. As a Hermes Desktop user, I want normal successful connection state to disappear into the background, so that the conversation remains the center of the product.
11. As a Hermes Desktop user, I want to send a message with Enter, so that the app behaves like a chat client.
12. As a Hermes Desktop user, I want Shift+Enter to create a newline, so that I can write longer prompts.
13. As a Hermes Desktop user, I want my submitted message to appear immediately, so that I get instant feedback.
14. As a Hermes Desktop user, I want streaming assistant replies to appear in place, so that I can follow the response as it is generated.
15. As a Hermes Desktop user, I want thinking or reasoning content to remain readable when the gateway emits it, so that agent behavior is still observable.
16. As a Hermes Desktop user, I want tool calls to appear inside the conversation when they happen, so that I can see what Hermes is doing.
17. As a Hermes Desktop user, I want tool call failures to be visible in the conversation, so that I understand when an answer may be incomplete.
18. As a Hermes Desktop user, I want send failures to leave me in the same conversation, so that I can retry without losing context.
19. As a Hermes Desktop user, I want an empty conversation state that invites me to start typing, so that the app feels ready rather than blank.
20. As a Hermes Desktop user, I do not want Session History visible on first launch, so that past work does not distract from my current task.
21. As a Hermes Desktop user, I do not want cron or source filters visible on first launch, so that I am not exposed to internal categorization.
22. As a Hermes Desktop user, I do not want settings visible on the main screen, so that configuration does not compete with conversation.
23. As a Hermes Desktop user, I do not want model selection visible by default, so that I can rely on Hermes' current configuration.
24. As a Hermes Desktop user, I do not want reasoning strength visible by default, so that I can start with the default behavior.
25. As a Hermes Desktop user, I want advanced controls to be absent rather than merely visually minimized, so that the MVP has a clear product shape.
26. As a Hermes Desktop user, I want the app to preserve the security boundary where the renderer never receives the dashboard token, so that local credentials remain protected.
27. As a Hermes Desktop user, I want the app to keep using the local gateway proxy, so that the desktop client remains a safe shell around Hermes dashboard.
28. As a Hermes Desktop user, I want the window to feel like a focused conversation surface, so that Hermes Desktop is not confused with Hermes dashboard.
29. As a Hermes Desktop maintainer, I want the implementation to remove first-screen dependencies on Session History, so that future history work does not block the new conversation path.
30. As a Hermes Desktop maintainer, I want the implementation to keep existing message event handling intact, so that streaming, reasoning, and tool calls continue to work.
31. As a Hermes Desktop maintainer, I want the implementation to keep Gateway Reconnect terminology precise, so that reconnect does not imply dashboard restart or token refresh.
32. As a Hermes Desktop maintainer, I want tests at the user-visible chat-page seam, so that the product promise is protected without over-testing internals.
33. As a Hermes Desktop maintainer, I want removed first-screen functionality to be explicitly out of scope, so that agents do not reintroduce hidden complexity during implementation.

## Implementation Decisions

- The default product surface is a single conversation screen, not a two-column workbench.
- On initial gateway readiness, the app creates a new session automatically and renders it as the active conversation.
- The first screen does not render Session History, session source filters, settings navigation, model selection, or reasoning controls.
- Existing gateway connection handling remains the source of truth for connection readiness.
- Existing conversation event handling remains the source of truth for message streaming, reasoning deltas, thinking deltas, tool events, completion events, and error events.
- The renderer continues to connect only to the local backend gateway proxy.
- The Node backend continues to hold the Hermes dashboard token; this PRD does not change the security boundary.
- Gateway Reconnect remains available only as an exception recovery action, shown when the renderer-to-backend WebSocket is closed or errored.
- The empty state should be minimal and conversation-oriented, not explanatory product copy.
- The send box should remain present in both connecting and ready states, with disabled behavior and placeholder text communicating readiness.
- Configuration defaults are inherited from Hermes/dashboard; the main screen should not ask the user to select model or reasoning effort.
- Session History is not deleted as a domain capability, but it is not part of the default visible product surface for this MVP direction.
- Any existing code that fetches Session History solely for the visible sidebar should be removed from the default chat path or made unreachable from the first screen.
- Tool call and reasoning rendering remain visible inside the transcript because they are part of understanding the current conversation, not separate management UI.
- Error UI should be lightweight and local to the conversation surface.
- Avoid adding a new app-level navigation structure for this PRD. The goal is subtraction and focus.
- Avoid introducing a new persistence or session-management abstraction unless required to preserve the automatic new conversation flow.
- The design should remain compatible with future reintroduction of advanced surfaces, but those surfaces should not leak into the first-screen experience.

## Testing Decisions

- The primary testing seam is the renderer chat-page external behavior: when the gateway becomes ready, the user sees a new conversation surface with an input and no visible Session History, settings, model, reasoning, or source-filter UI.
- Tests should assert user-visible behavior rather than internal hook state.
- A good test renders the chat experience with a controlled gateway client or provider seam, drives readiness and message events, and asserts what the user can see and do.
- A good test verifies that an unavailable gateway shows a lightweight connection or retry state without exposing dashboard/token details.
- A good test verifies that sending a message still appends the user message and triggers the prompt submission contract for the active session.
- A good test verifies that streamed assistant deltas still appear in the transcript after simplifying the UI.
- A good test verifies that tool calls and reasoning parts still render in the transcript when events are emitted.
- A good test verifies that first-screen advanced UI is absent: no Session History list, no cron/source filter, no settings entry, no model selector, and no reasoning selector.
- Existing shared-package pure function tests for stored history and tool-event normalization are useful prior art, but they are not the main seam for this PRD.
- Backend proxy tests are not required unless implementation changes the backend contract. This PRD should be achievable primarily in the desktop renderer.
- Manual verification should run the backend and desktop app, open the app, confirm a new conversation is created, send a message, observe streaming response, and confirm no first-screen management UI is present.

## Out of Scope

- Redesigning or improving Session History.
- Adding history search.
- Adding session rename, delete, archive, pin, branch, undo, interrupt, or compress controls.
- Adding or redesigning settings screens.
- Adding model-provider authentication UI.
- Exposing model selection on the main screen.
- Exposing reasoning strength on the main screen.
- Changing how Hermes dashboard is started or supervised.
- Changing the dashboard token ownership model.
- Changing the JSON-RPC gateway protocol.
- Adding cloud sync, accounts, multi-workspace support, or remote sessions.
- Building a general Hermes dashboard replacement.
- Removing shared history/tool normalization logic that is still needed by future surfaces or current message rendering.

## Further Notes

- This PRD intentionally prioritizes product clarity over feature density.
- The existing domain term Gateway Reconnect should be used precisely: it means re-establishing the renderer-to-backend WebSocket connection at `ws://localhost:8765/ws`, not restarting the dashboard process or refreshing a token.
- The existing domain term Session History should remain reserved for resumable conversation summaries. In this PRD, Session History is not the first-screen product experience.
- The MVP should feel like opening a blank, ready Hermes conversation rather than opening an administration console.
