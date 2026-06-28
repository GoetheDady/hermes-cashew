Status: 可交付-agent

# Cashew Presence state

## Parent

`.scratch/cashew-desktop-experience/PRD.md`

## What to build

Add a compact Cashew Presence signal that tells the user whether Hermes is waking, ready, thinking, using tools, idle, reconnecting, or unavailable. The signal should feel alive through subtle copy and motion, but it must stay small enough not to compete with the conversation.

## Acceptance criteria

- [x] A pure presence model maps connection, readiness, session loading, streaming, tool activity, idle, and midnight inputs to a stable display state.
- [x] The chat screen shows the current Cashew Presence state near the primary conversation surface.
- [x] Presence copy stays short and does not expose dashboard token or backend implementation details.
- [x] Reduced-motion users do not receive decorative motion.
- [x] The presence model has focused unit tests.
- [x] New or changed functions include JSDoc.

## Blocked by

- `.scratch/cashew-desktop-experience/issues/01-cashew-palette-system.md`
