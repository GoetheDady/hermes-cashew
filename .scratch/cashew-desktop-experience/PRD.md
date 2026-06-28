Status: 可交付-agent

# PRD: Cashew Desktop Experience

## Problem Statement

The current Cashew Desktop already connects to Hermes agent and has the beginnings of a warm visual direction, but the experience still risks feeling like a generic chat client. The user wants a personal Hermes desktop that is minimal, warm, and alive, and that intentionally does not inherit the appearance or feature density of the Official Hermes Desktop.

## Solution

Build a focused Cashew Desktop experience around three product pillars:

1. A cohesive Cashew Palette visual system that makes the app feel warm and intentional.
2. Cashew Presence states that make the assistant feel quietly alive without adding a noisy control surface.
3. A minimal Session History and continue-last-session flow that gives the app memory while preserving a clean first screen.

## User Stories

1. As the owner of Cashew Desktop, I want the app to use a cohesive cashew-inspired palette, so that it feels like my own Hermes client.
2. As the owner of Cashew Desktop, I want the UI to avoid cold slate or generic dashboard colors, so that it does not feel like a control panel.
3. As the owner of Cashew Desktop, I want the chat surface to stay visually calm, so that long conversations remain comfortable.
4. As the owner of Cashew Desktop, I want the midnight atmosphere to stay warm and low-brightness, so that late-night use feels gentle.
5. As the owner of Cashew Desktop, I want connection and activity states to be visible at a glance, so that I know whether Hermes is ready.
6. As the owner of Cashew Desktop, I want the assistant to show subtle presence while idle, so that the app feels alive rather than static.
7. As the owner of Cashew Desktop, I want streaming and thinking states to feel distinct, so that I understand what Hermes is doing.
8. As the owner of Cashew Desktop, I want status feedback to stay small, so that it does not compete with the conversation.
9. As the owner of Cashew Desktop, I want to continue my last conversation when useful, so that the app has memory.
10. As the owner of Cashew Desktop, I want to start a clean new conversation immediately, so that memory never gets in my way.
11. As the owner of Cashew Desktop, I want Session History to be available without permanently crowding the screen, so that the default surface stays minimal.
12. As the owner of Cashew Desktop, I want history items to read like memory fragments, so that past conversations feel human-scale.
13. As the owner of Cashew Desktop, I want cron sessions hidden by default but available, so that automation noise does not dominate my personal chat history.
14. As the owner of Cashew Desktop, I want my visual and history preferences remembered locally, so that the app returns to the shape I chose.
15. As the owner of Cashew Desktop, I want keyboard-friendly access to history and new sessions, so that common actions do not require hunting.
16. As the owner of Cashew Desktop, I want failures to preserve my current text and context, so that reconnects do not feel like lost work.
17. As a developer, I want the presence logic separated from React rendering, so that the state model can be tested directly.
18. As a developer, I want visual tokens centralized, so that future UI work does not drift away from the Cashew Palette.
19. As a developer, I want Session History integration to reuse the existing gateway/session boundaries, so that the frontend does not learn dashboard token details.
20. As a developer, I want each slice to be independently demoable, so that the experience can evolve without a large risky rewrite.

## Implementation Decisions

- Build on the existing renderer, gateway client, session hooks, and local backend proxy. No new external service or token exposure is needed.
- Treat Cashew Palette as a tokenized visual language in CSS variables, with light and midnight variants.
- Avoid a full settings-heavy theme editor. The user asked for a strong product direction, not user-selectable skins.
- Introduce a small Cashew Presence model that maps connection, session, streaming, idle, and midnight inputs into a compact display state.
- Keep Cashew Presence as a deep module with a small pure interface so it can be tested without rendering the desktop.
- Reuse existing Session History REST and gateway resume behavior. The feature is about surfacing memory, not changing persistence.
- Keep Session History minimal by default. It may be hidden, overlayed, or softly docked, but it should not turn the first screen into a dense dashboard.
- Add local preference persistence only for UI-level choices such as history visibility; do not persist Hermes credentials or dashboard tokens in the renderer.
- Public/backend contracts should remain unchanged unless a vertical slice proves a missing field is necessary.
- Follow the repository's JSDoc rule for every new or modified function.

## Testing Decisions

- Good tests should verify external behavior: given connection/session/streaming inputs, the presence module returns the expected status and tone.
- Test the presence state model as a pure module before wiring it into React.
- Test any preference store helper as a pure or hook-adjacent unit only if logic becomes non-trivial.
- Use existing shared package tests as prior art for small TypeScript unit tests.
- Run desktop typechecking regularly while editing renderer code.
- Run the full repository typecheck at the end, plus existing shared tests if code touches shared behavior.
- Visual verification should include launching the desktop dev server when practical and checking the primary chat screen at desktop size.

## Out of Scope

- Recreating the Official Hermes Desktop.
- Adding a full command palette.
- Adding a full theme editor or multiple skins.
- Changing Hermes dashboard authentication or exposing dashboard tokens to the renderer.
- Reworking model selection and reasoning settings beyond preserving their current behavior.
- Building a large observability console for backend/dashboard internals.
- Search across all historical messages.
- Cross-device sync.

## Further Notes

The core product constraint is Living Minimalism: the app should gain memory and presence without becoming busy. When in doubt, prefer one small living signal over another visible panel.
