# PRD: Subtle Motion

Status: 可交付-agent

## Problem Statement

Hermes Desktop 当前已经收敛为「打开即新对话」的极简对话入口，并补上了基础可靠性。但界面仍然偏静态：连接中、空状态、新消息出现、streaming、thinking/tool block 出现、错误提示出现/消失等状态变化都比较突然，整体感觉像一个冷冰冰的对话框。

用户希望它「活起来」，但明确不想要人格化文案、角色设定、装饰背景、复杂动效或新功能。期望是界面本身有一点生命感：安静、克制、有呼吸，而不是花哨或拟人。

现在的风险是，如果继续只做功能和文案，产品会越来越可靠但仍然像静态表单；如果动效做过头，又会破坏这个产品已经形成的极简、工作型气质。

## Solution

为现有单一对话界面加入克制的微动效，让状态变化更自然，但不改变产品结构和功能范围。

使用 Motion 作为 React 动画库：

- 安装 `motion` 包。
- 在 React 组件中从 `motion/react` 引入 `motion` 和 `AnimatePresence`。
- 只用 Motion 做现有 UI 元素的状态微动效，不做页面级动画系统。

动效范围：

- 连接中状态使用轻微呼吸点或低强度 pulse，替代硬质静态感。
- 输入框 focus 时有很轻的边框/阴影变化，让它像当前活跃入口。
- 新用户消息和 assistant 消息出现时轻微 fade + translate。
- streaming 中的空 assistant 状态或省略号有轻微透明度 pulse。
- thinking block 和 tool call block 出现时轻微 fade/slide，不突然砸到页面上。
- 错误提示出现/消失时轻微 slide/fade。

动效原则：

- 动效应该短、轻、安静。
- 动效应该服务状态变化，而不是成为视觉装饰。
- 健康状态下界面仍然极简。
- 不增加新功能、不增加导航、不恢复 Session History。
- 不改变 Gateway Reconnect、会话创建、发送、streaming、tool call 的业务语义。

建议默认参数：

- 常规 enter：`duration` 约 0.16-0.24 秒，`ease: "easeOut"`。
- exit：`duration` 约 0.12-0.18 秒。
- 呼吸/pulse：透明度或阴影小幅变化，周期不快于约 1.2 秒。
- translate 距离小，通常 4-8px。
- 避免 bounce、强 spring、大幅缩放和大面积背景动画。

## User Stories

1. As a Hermes Desktop user, I want the connecting state to feel softly alive, so that the app does not feel frozen while Hermes is preparing.
2. As a Hermes Desktop user, I want the empty conversation state to have a subtle sense of readiness, so that the screen feels awake without becoming decorative.
3. As a Hermes Desktop user, I want the input area to respond gently when focused, so that I can feel where the active task entry point is.
4. As a Hermes Desktop user, I want new user messages to appear smoothly, so that sending a message feels acknowledged.
5. As a Hermes Desktop user, I want new assistant messages to appear smoothly, so that streaming feels natural instead of abrupt.
6. As a Hermes Desktop user, I want the assistant waiting state to pulse subtly, so that I know Hermes is working before text appears.
7. As a Hermes Desktop user, I want thinking blocks to appear gently, so that reasoning content feels integrated into the transcript.
8. As a Hermes Desktop user, I want tool call blocks to appear gently, so that agent activity feels observable without feeling like a log dump.
9. As a Hermes Desktop user, I want error messages to slide or fade in lightly, so that failures are visible without feeling harsh.
10. As a Hermes Desktop user, I want error messages to disappear cleanly when resolved, so that recovery feels smooth.
11. As a Hermes Desktop user, I want all motion to remain subtle, so that the app keeps its quiet working-tool personality.
12. As a Hermes Desktop user, I do not want background animation, so that the conversation remains the focus.
13. As a Hermes Desktop user, I do not want character animation or avatars, so that Hermes does not become over-personified.
14. As a Hermes Desktop user, I do not want motion to slow down typing, sending, streaming, or reading, so that the app remains efficient.
15. As a Hermes Desktop user, I want motion to support current status changes, so that the UI feels alive without adding more controls.
16. As a Hermes Desktop user, I want Gateway Reconnect and error recovery behavior to remain unchanged, so that reliability is not affected by animation.
17. As a Hermes Desktop user, I want message layout to remain stable, so that animations do not make text jump or overlap.
18. As a Hermes Desktop user, I want long responses to stay readable while streaming, so that animation does not compete with content.
19. As a Hermes Desktop user, I want tool results to remain scannable, so that motion does not obscure important details.
20. As a Hermes Desktop user, I want reduced-motion preferences to be respected where practical, so that motion does not become uncomfortable.
21. As a Hermes Desktop maintainer, I want Motion usage to stay localized to presentation components, so that business logic remains simple.
22. As a Hermes Desktop maintainer, I want animation constants or patterns to be consistent, so that the UI does not develop mismatched motion styles.
23. As a Hermes Desktop maintainer, I want tests to verify visible behavior remains present, so that animation work does not break conversation functionality.
24. As a Hermes Desktop maintainer, I want implementation to avoid testing Motion internals, so that tests remain stable across animation refactors.
25. As a Hermes Desktop maintainer, I want package changes to be minimal, so that adding Motion does not introduce unrelated dependencies.
26. As a Hermes Desktop maintainer, I want the app to continue building in Electron/Vite after adding Motion, so that production packaging remains safe.
27. As a Hermes Desktop maintainer, I want no Session History, settings, model selector, or reasoning selector to reappear as part of this work, so that product focus is preserved.
28. As a Hermes Desktop maintainer, I want no new route or global layout redesign, so that this remains a micro-interaction pass.
29. As a Hermes Desktop maintainer, I want motion to stay compatible with current stream, thinking, reasoning, and tool call rendering, so that existing agent observability remains intact.
30. As a Hermes Desktop maintainer, I want the renderer to continue talking only to the local gateway proxy, so that animation work does not affect the security boundary.

## Implementation Decisions

- Add the `motion` package as the animation dependency.
- Use `motion/react` imports for React components.
- Apply Motion only in renderer presentation surfaces.
- Keep the existing conversation page structure.
- Keep existing Gateway Reconnect, session creation, send, streaming, thinking, reasoning, and tool-call logic unchanged.
- Use `AnimatePresence` for transient UI such as error/status messages.
- Use `motion` wrappers for transcript message appearance.
- Use low-amplitude opacity/translate transitions for message enter animations.
- Use subtle pulse animation for connecting or assistant waiting states.
- Use CSS or Motion focus state for the input container glow, whichever best matches the current component structure.
- Avoid global animated backgrounds.
- Avoid avatars, mascots, personality animation, sound, and large decorative effects.
- Avoid strong spring/bounce animations.
- Avoid animating every streamed token; streaming text should remain readable and efficient.
- Respect reduced-motion preferences where practical through CSS media queries or Motion configuration.
- Prefer a small local motion vocabulary over many bespoke transitions.
- Do not introduce a new design system abstraction unless duplication becomes meaningful.
- Do not change the backend, dashboard token ownership, or gateway protocol.

## Testing Decisions

- The primary testing seam is the single conversation page's external behavior with motion enabled.
- Tests should verify that the same user-visible states still appear: connecting, ready empty state, user message, assistant streaming placeholder, thinking/tool blocks, and error/status message.
- Tests should not assert Motion implementation details, timing values, generated DOM wrappers, or animation internals.
- A good test verifies that first-screen management UI remains absent after motion changes.
- A good test verifies that status/error messages still appear and can disappear when cleared.
- A good test verifies that message content remains visible after the message animation wrapper is introduced.
- A good test verifies that sending and streaming behavior are not blocked by animation wrappers.
- If automated renderer behavior tests are not already available, typecheck, lint, and Electron/Vite build are required verification, plus targeted manual QA.
- Manual QA should inspect connecting state, ready empty state, sending first message, assistant waiting state, streaming response, tool/thinking block appearance, and error banner appearance.
- Manual QA should check that animations are subtle and do not cause layout jumps or text overlap.
- Manual QA should check a reduced-motion environment if practical.
- Existing shared-package tests for message and tool normalization are not the main seam for this PRD, but should continue to pass.

## Out of Scope

- Adding Session History back to the first screen.
- Adding settings, model selection, or reasoning controls to the main screen.
- Changing product copy beyond what is necessary to fit existing states.
- Adding avatars, mascots, character animation, or personality layers.
- Adding background animations, gradient orbs, decorative scenes, or landing-page visuals.
- Adding sound effects.
- Adding page transitions or route-level animation.
- Animating every streamed token.
- Redesigning message bubble layout.
- Redesigning thinking/tool call semantics.
- Changing Gateway Reconnect behavior.
- Changing session creation, prompt submission, or backend health behavior.
- Changing the dashboard token ownership model.
- Adding a full renderer test framework solely for animation timing assertions.

## Further Notes

- The desired feeling is not "Hermes has a personality"; it is "the interface has breath."
- Motion should be a fine brush, not a fireworks show.
- This PRD intentionally follows the existing product direction: one quiet conversation surface, no management UI in the first screen.
- If an animation is noticeable enough to distract from reading or typing, it is too strong.
