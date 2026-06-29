# Lazy session creation on new conversation

Entering the app or pressing 新对话 opens a Fresh Conversation that is held only in the renderer until the first message is sent; `session.create` is deferred to the first `prompt.submit`. We chose this over eager creation because `session.create` persists a session to Session History immediately even with zero messages (see `presence.ts`, which two-step deletes its temporary sessions for exactly this reason), so eager creation on entry would leave phantom empty sessions whenever the user picks Continue Last instead.

## Consequences

- `sendMessage` must create-on-demand: when `sessionIdRef` is empty it calls `ensureSession()` (create + set runtime/stored id + refresh list) before `prompt.submit`; subsequent sends reuse the id.
- The empty state must accept input without an active session — `hasActiveSession` no longer gates `canSend` or the textarea; it becomes a display-only flag for presence.
- 新对话 (sidebar) resets to the empty state locally without calling `session.create`; the only explicit entry affordance is Continue Last.
