Status: 可交付-agent

# PRD: Session History Drawer

## Problem Statement

Cashew Desktop already has Session History, but its current layout has two problems.

First, Session History is a fixed-width side-by-side panel. In a narrow desktop window, it compresses the chat canvas and input area too much, so the app loses the calm, low-friction feel promised by Living Minimalism. In the measured 720px-wide state, the 288px history panel leaves the main input area around 408px wide.

Second, the chat layout contains a positioning mismatch: user messages are described as right-aligned, but the rendered message row currently uses the same left alignment as assistant messages. This weakens the conversational layout and makes user/assistant turns less scannable.

The user wants Codex-like history behavior: a persistent side-by-side Session History Sidebar when intentionally opened, and a temporary Session History Drawer when the user only wants to glance at history without changing the main layout.

## Solution

Introduce two explicit forms of Session History:

1. Session History Sidebar: the persistent side-by-side form opened by clicking the "记忆" button in a large window.
2. Session History Drawer: the temporary overlay form that does not change chat canvas width.

Large-window behavior:

- Clicking "记忆" opens or closes the persistent Session History Sidebar.
- After the user manually closes the Sidebar, a 12px invisible left-edge hover trigger zone becomes active.
- Hovering that trigger zone opens the temporary Session History Drawer after a short delay.
- Leaving the Drawer closes it after a short delay.
- Selecting a session from the temporary Drawer closes the Drawer and returns focus to the chat.
- Selecting a session from the persistent Sidebar does not close the Sidebar.

Narrow-window behavior:

- Clicking "记忆" opens Session History as an overlay Drawer instead of a side-by-side Sidebar.
- The Drawer does not compress the chat canvas or input area.
- Hover-trigger behavior is disabled in narrow windows.
- Selecting a session from the Drawer closes the Drawer and returns focus to the chat.

Also fix user message alignment so user turns are visually distinct from assistant turns.

## User Stories

1. As the owner of Cashew Desktop, I want Session History to stop crushing the chat input in narrow windows, so that the app remains comfortable to use.
2. As the owner of Cashew Desktop, I want a large-window click on "记忆" to open a persistent Sidebar, so that I can browse history while still seeing the chat.
3. As the owner of Cashew Desktop, I want clicking "记忆" again to close the persistent Sidebar, so that I can return to a clean chat canvas.
4. As the owner of Cashew Desktop, I want the manually closed Sidebar to leave a subtle left-edge hover trigger zone, so that I can recall history quickly without a visible extra control.
5. As the owner of Cashew Desktop, I want hovering the left edge in a large window to show the temporary Drawer, so that I can glance at history without changing the chat layout.
6. As the owner of Cashew Desktop, I want the hover Drawer to appear only after a tiny delay, so that accidental edge passes do not constantly open it.
7. As the owner of Cashew Desktop, I want the hover Drawer to close when my pointer leaves it, so that the screen returns to the clean chat surface automatically.
8. As the owner of Cashew Desktop, I want the hover Drawer to close shortly after leaving, so that it feels responsive without flickering.
9. As the owner of Cashew Desktop, I want the hover trigger zone to be narrow, so that it is easy to hit intentionally but not easy to trigger accidentally.
10. As the owner of Cashew Desktop, I want the hover trigger zone to be inactive while the persistent Sidebar is open, so that there are not two competing history surfaces.
11. As the owner of Cashew Desktop, I want narrow windows to use a Drawer when I click "记忆", so that the main chat width is preserved.
12. As the owner of Cashew Desktop, I want narrow windows not to use hover-trigger history, so that edge movement does not produce surprising UI.
13. As the owner of Cashew Desktop, I want selecting a session from a temporary Drawer to close the Drawer, so that focus returns to the resumed chat.
14. As the owner of Cashew Desktop, I want selecting a session from the persistent Sidebar to keep the Sidebar open, so that I can continue browsing history intentionally.
15. As the owner of Cashew Desktop, I want starting a new session from a temporary Drawer to close the Drawer, so that the new chat starts in a clear canvas.
16. As the owner of Cashew Desktop, I want starting a new session from the persistent Sidebar to follow the current explicit Sidebar behavior, so that the app does not surprise me.
17. As the owner of Cashew Desktop, I want the Drawer to feel like a temporary overlay rather than a second page, so that history stays lightweight.
18. As the owner of Cashew Desktop, I want the Drawer to preserve the Cashew Palette and Living Minimalism, so that it does not feel like a generic dashboard.
19. As the owner of Cashew Desktop, I want the "记忆" button to remain the primary explicit history control, so that I do not need to learn a new command.
20. As the owner of Cashew Desktop, I want the Drawer animation to be calm and brief, so that it feels alive without slowing me down.
21. As the owner of Cashew Desktop, I want the main input width to remain stable when a Drawer opens, so that my writing space does not jump.
22. As the owner of Cashew Desktop, I want the main chat canvas to remain stable when a Drawer opens, so that reading position and layout are not disturbed.
23. As the owner of Cashew Desktop, I want user messages to align to the right, so that my messages and Hermes responses are visually distinct.
24. As the owner of Cashew Desktop, I want assistant messages to remain left-aligned, so that the conversation reads like a two-sided exchange.
25. As the owner of Cashew Desktop, I want the layout to stay usable at the default Electron window size, so that the common desktop state feels polished.
26. As the owner of Cashew Desktop, I want the layout to stay usable around 720px window width, so that narrower desktop windows do not break the experience.
27. As a developer, I want Sidebar and Drawer states to be named distinctly, so that implementation code matches the product language in CONTEXT.md.
28. As a developer, I want layout behavior to be expressed with Tailwind utilities first, so that the renderer stays consistent with the existing styling approach.
29. As a developer, I want the responsive threshold to be centralized or easy to locate, so that future layout tuning is not scattered through unrelated components.
30. As a developer, I want new or changed functions to include complete JSDoc, so that the project-level commenting rule remains satisfied.
31. As a developer, I want tests to verify visible behavior rather than internal state names, so that refactors do not break tests unnecessarily.

## Implementation Decisions

- Use the domain terms already added to CONTEXT.md: Session History Sidebar for the persistent side-by-side form, and Session History Drawer for the temporary overlay form.
- Keep "记忆" as the explicit control for opening and closing Session History.
- Large-window click behavior opens the persistent Sidebar.
- Narrow-window click behavior opens the Drawer instead of the Sidebar.
- Large-window hover behavior only exists after the user manually closes the persistent Sidebar.
- The hover trigger zone is invisible, starts at the left edge of the window, and is 12px wide.
- The hover trigger zone should not be active while the persistent Sidebar is open.
- The hover trigger zone should not be active in narrow windows.
- Use an open delay around 120-180ms for the hover Drawer.
- Use a close delay around 80-120ms for pointer-leave closing.
- Selecting a session from a temporary Drawer closes that Drawer.
- Selecting a session from a persistent Sidebar leaves that Sidebar open.
- Starting a new session from a temporary Drawer closes that Drawer.
- The Drawer overlays the chat surface and must not reduce the chat canvas or input width.
- Prefer Tailwind utility classes for layout, spacing, visibility, responsive state, and overlay positioning. Add custom CSS only when Tailwind cannot express the required Electron or animation behavior cleanly.
- Preserve existing Window Drag Region and Traffic Light Avoidance Zone behavior; history surfaces must not steal clicks from window controls or drag-only areas.
- Fix message alignment so user messages are right-aligned and assistant messages remain left-aligned.
- Keep the current Session History data contract. This feature changes layout and interaction, not gateway persistence.
- Continue using local UI preference storage for explicit Sidebar visibility, but do not persist temporary hover Drawer visibility as a lasting preference.
- New or changed functions must include complete JSDoc comments with parameter and return semantics.

## Testing Decisions

- The highest-value test seam is the chat page user behavior: given a viewport size and user interaction, verify whether Session History appears as a Sidebar or Drawer and whether the chat canvas remains stable.
- A second useful seam is the layout helper/model that determines whether the current window should use Sidebar or Drawer behavior. If introduced, it should be pure and tested directly.
- Existing small TypeScript tests for window chrome and session sidebar layout are good prior art for focused layout rules.
- Tests should verify externally observable behavior: visible history surface, preserved input width, auto-close after selection, and user message alignment.
- Tests should avoid coupling to internal state names such as `isMemoryOpen` unless those names are part of a pure helper contract.
- Include a test or browser check for large-window click behavior: clicking "记忆" opens a persistent Sidebar and selecting a session does not close it.
- Include a test or browser check for large-window hover behavior: after manually closing the Sidebar, entering the left-edge trigger opens a Drawer and leaving closes it.
- Include a test or browser check for narrow-window click behavior: clicking "记忆" opens a Drawer and does not compress the main input area.
- Include a test or browser check that hover trigger does not open a Drawer in narrow windows.
- Include a test or browser check that selecting a session from a Drawer closes the Drawer.
- Include a layout regression check that user messages render on the right and assistant messages render on the left.
- Visual QA should cover at least 720px, 900px, and 1200px wide windows.
- Visual QA should cover both default chat state and Session History open states.
- Run renderer typechecking after implementation.
- Run existing relevant tests for window chrome, session sidebar, and message rendering behavior.

## Out of Scope

- Changing how Hermes gateway returns Session History.
- Adding full-text search across Session History.
- Adding a new navigation page for history.
- Changing model selection or reasoning settings.
- Changing backend token handling or exposing dashboard tokens to the renderer.
- Reworking the Cashew Palette.
- Redesigning all message bubble styling beyond fixing user/assistant alignment.
- Implementing touch/mobile gestures.
- Adding a visible left-edge handle unless a later design pass explicitly asks for it.
- Persisting temporary hover Drawer open state.

## Further Notes

- "Drawer" means an overlay panel that sits above the chat surface and does not participate in the main flex layout.
- "Sidebar" means a persistent layout column that sits beside the chat surface and may reduce the main chat width.
- "Hover trigger zone" means an invisible pointer-sensitive strip along the left edge. It should be treated as an affordance for large desktop windows, not as the primary history control.
- "Breakpoint" means the viewport width threshold where the app switches between large-window and narrow-window behavior. The measured layout suggests a threshold around 840-900px, with the exact value to be chosen during implementation and visual QA.
- The core product goal is to keep Session History available without letting it turn Cashew Desktop into a dense control panel.
