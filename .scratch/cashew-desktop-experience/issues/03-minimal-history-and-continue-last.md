Status: 可交付-agent

# Minimal Session History and continue last conversation

## Parent

`.scratch/cashew-desktop-experience/PRD.md`

## What to build

Surface Session History as a minimal memory layer instead of a permanent dashboard. The user should be able to continue the most recent conversation, start fresh, and reveal or hide history without losing the clean first screen.

## Acceptance criteria

- [x] When previous sessions are available, the chat screen offers a clear continue-last-session path and a clear new-session path.
- [x] Session History can be shown and hidden from the chat screen without navigating away.
- [x] History items remain compact memory fragments with title, preview, and lightweight metadata.
- [x] Cron sessions remain hidden by default and can still be toggled visible.
- [x] History visibility preference is remembered locally without persisting credentials or dashboard tokens.
- [x] New or changed functions include JSDoc.

## Blocked by

- `.scratch/cashew-desktop-experience/issues/02-cashew-presence-state.md`
