# PRD: Minimal Vitality

Status: 可交付-agent

## Problem Statement

Hermes Desktop 当前功能上已经能完成对话，但体感仍偏机械：消息会突然出现，输入框在未聚焦时像静止表单，深夜与白天没有任何差异。用户面对的是一个可靠但冷的工具，而不是一个安静在场的桌面助手。

用户希望 Hermes Desktop 在不改变布局、不增加功能、不引入人格化角色的前提下，有一点微弱的呼吸感、时间感和人在另一端逐步回应的感觉。这种生命力应该极简、克制、几乎只在潜意识层面被感知。

## Solution

在现有单一聊天页加入三项只改变体感、不改变信息架构的微动效：

1. 输入框空闲时增加极浅、极慢的呼吸光晕，让主要输入入口即使未聚焦也像是醒着的。
2. 新产生的消息逐条淡入，而历史加载和网关回放内容保持即时渲染，让新回复更像逐步到达，而不是一次性刷屏。
3. 午夜时段自动切换到更暖、更慢的氛围变量，让应用对 0-5 点的使用场景有轻微感知。

这是一版比现有 Living Presence 更小的需求：不引入后端 Presence Engine，不生成新文案，不增加接口，不新增 UI 元素，只在现有渲染层和主题变量上做微调。

## User Stories

1. As a Hermes Desktop user, I want the idle input area to breathe very slowly, so that the app feels quietly alive even before I type.
2. As a Hermes Desktop user, I want the idle input glow to be extremely subtle, so that it does not distract me from reading or thinking.
3. As a Hermes Desktop user, I want the focused input glow to remain more noticeable than the idle glow, so that focus state still feels clear.
4. As a Hermes Desktop user, I want idle breathing and focused breathing to never compete, so that the input area has one coherent state at a time.
5. As a Hermes Desktop user, I want new messages to fade in gently, so that the conversation feels less like a machine dump.
6. As a Hermes Desktop user, I want new messages to move only a tiny distance while appearing, so that the transcript stays stable and readable.
7. As a Hermes Desktop user, I want multiple newly rendered messages to appear with small staggered delays, so that they feel like they are arriving one by one.
8. As a Hermes Desktop user, I want historical messages to appear instantly, so that opening or restoring a conversation does not replay old content theatrically.
9. As a Hermes Desktop user, I want gateway replay content to appear instantly, so that recovery does not feel like the assistant is retyping old context.
10. As a Hermes Desktop user, I want streaming text to remain readable, so that animation never competes with the assistant's answer.
11. As a Hermes Desktop user, I want midnight use to feel a little warmer, so that the app does not feel harsh late at night.
12. As a Hermes Desktop user, I want midnight motion to slow down slightly, so that the app feels calmer during late-night sessions.
13. As a Hermes Desktop user, I want the app to return to its normal color and rhythm outside midnight hours, so that the daytime experience remains unchanged.
14. As a Hermes Desktop user, I want the time-based atmosphere to update without restarting the app, so that crossing into or out of midnight hours is handled naturally.
15. As a Hermes Desktop user, I want all of these changes to preserve the current layout, so that I do not have to relearn the interface.
16. As a Hermes Desktop user, I do not want new controls or settings for this feature, so that the app stays minimal.
17. As a Hermes Desktop user, I do not want sound, particles, background animation, avatars, or decorative scenes, so that the conversation remains the focus.
18. As a Hermes Desktop user with reduced-motion preferences, I want nonessential movement to be minimized where practical, so that the app remains comfortable.
19. As a Hermes Desktop maintainer, I want these changes to stay localized to the renderer and theme layer, so that Gateway Reconnect, session creation, and token ownership remain untouched.
20. As a Hermes Desktop maintainer, I want the new-message detection rule to be explicit, so that future history or resume work does not accidentally animate old messages.
21. As a Hermes Desktop maintainer, I want stagger delays to be stable for a mounted message, so that rerenders do not cause visual jitter.
22. As a Hermes Desktop maintainer, I want this feature to remain dependency-free, so that the existing Motion setup is reused rather than expanded.
23. As a Hermes Desktop maintainer, I want the implementation to keep business logic unchanged, so that this remains a visual feel pass rather than a conversation behavior change.

## Implementation Decisions

- Modify the existing conversation page presentation only; do not change backend routes, gateway protocol, session lifecycle, message sending, streaming behavior, or dashboard token ownership.
- Reuse the existing Motion dependency and reduced-motion hook already present in the renderer. Do not add new runtime dependencies.
- Keep the existing input container and footer layout. The idle state changes only the container shadow animation.
- Replace the current idle input shadow with a low-opacity breathing box shadow: a 4-second cycle in normal hours, ease-in-out, with foreground-derived opacity in the 3%-8% range.
- Preserve the existing focused input breathing behavior: a 2.2-second three-stage focused glow remains the stronger, higher-attention state.
- Focused input state overrides idle input breathing. There should be no additive overlap between idle and focused shadow animations.
- Introduce a midnight rhythm value so idle breathing can slow from 4 seconds to 6 seconds during 0-5 local hours.
- Wrap rendered transcript messages in Motion containers so each new visible message can enter with opacity 0 to 1 and translateY 2px to 0 over approximately 0.3 seconds.
- Do not animate messages that are part of initial history loading, session resume, or gateway replay. Those messages should render instantly.
- Track the count of messages that were present after initial history mapping. Messages whose rendered index is below that count are historical; messages at or above that count are eligible for the new-message enter animation.
- Ensure the initial history count is updated when the page receives a fresh initial history set, so reconnect or session creation behavior does not classify replayed messages as new.
- Apply a small stagger delay to eligible new messages, randomly distributed between 80ms and 200ms per message.
- The stagger value should be stable for a message while it is mounted. It may be derived from message identity or stored when the message first becomes eligible, but it should not be recalculated on every render.
- Use instant rendering when reduced-motion is enabled, or reduce the animation to a non-moving opacity change if that better matches existing renderer behavior.
- Add a renderer-level midnight state based on `new Date().getHours()`. Midnight mode is active when the local hour is 0, 1, 2, 3, 4, or 5.
- Check midnight mode once on mount and then once per minute with an interval. Minute precision is enough; there is no need for second-level timers.
- Inject a midnight class into the conversation root or app root scope so theme variables can be overridden through CSS rather than repeated JS animation.
- Override theme variables in midnight mode to make the dark surface warmer: foreground shifts from cold white toward warm white, and background shifts from pure black toward warm black.
- Use CSS transitions for color variable changes. The time-of-day atmosphere should not be a JavaScript animation loop.
- Keep all changes invisible to layout metrics: no new controls, no extra copy, no settings, no route changes, and no message bubble redesign.
- Keep the feature compatible with the existing Session History terminology: this PRD does not redefine Session History or expose transcripts.

## Testing Decisions

- The highest testing seam is the conversation page's visible behavior, because this feature is entirely about renderer presentation while preserving conversation semantics.
- No unit tests are required for exact animation timing, easing curves, random delay ranges, or CSS color interpolation. Those are visual feel decisions and would make brittle tests.
- A good verification checks external behavior: existing messages still render, new sent and received messages still render, sending remains blocked only by the existing readiness rules, and status/error rendering still works.
- If renderer tests already exist for the conversation page, they should assert that message content remains visible after Motion wrappers are introduced, without asserting Motion internals.
- If no renderer behavior test seam exists, verification should use typecheck/build plus manual QA rather than creating a new animation-specific test harness.
- Manual QA should open the client, leave the input idle, and confirm the footer glow breathes slowly without changing layout.
- Manual QA should focus the input and confirm the stronger focused breathing remains unchanged and overrides idle breathing.
- Manual QA should send a message and confirm newly created transcript entries fade in with a tiny upward settle.
- Manual QA should restore or replay historical messages and confirm they render instantly rather than replaying old content.
- Manual QA should adjust the system clock or otherwise simulate local hour 0 and confirm the app becomes subtly warmer within one minute.
- Manual QA should return the system clock outside 0-5 and confirm normal colors and rhythm return within one minute.
- Manual QA should confirm reduced-motion mode does not produce distracting movement.
- Existing build, typecheck, and lint checks should continue to pass.

## Out of Scope

- Adding Presence Engine or any backend-generated idle prompts.
- Adding time-aware greeting copy or rotating empty-state text.
- Adding holidays, seasons, solar terms, festivals, or location-aware atmosphere.
- Adding any new UI element, menu item, setting, preference, or toggle.
- Changing the chat layout, message bubble structure, footer placement, or sidebar behavior.
- Adding sound effects.
- Adding avatars, mascots, character animation, personality layers, or assistant "inner monologue."
- Adding background animation, particles, gradient orbs, decorative scenes, or page-level ambient visuals.
- Changing Gateway Reconnect, session creation, prompt submission, streaming, or backend health behavior.
- Changing dashboard token ownership or exposing dashboard credentials to the renderer.
- Adding new dependencies.
- Writing brittle automated tests for animation implementation details.

## Further Notes

- This PRD intentionally narrows the broader Living Presence direction into a minimal, implementation-ready pass.
- The desired feeling is "Hermes is quietly present," not "Hermes has become a character."
- If a motion detail becomes noticeable enough to pull attention away from reading or typing, it should be reduced.
- The user-provided implementation estimate is roughly 80-100 lines, concentrated in the conversation page and possibly the global theme CSS.
- The key design constraint is that nothing about the app should look redesigned at a glance; the change should be felt more than seen.
