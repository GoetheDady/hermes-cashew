# Hermes Desktop

Hermes Desktop is an Electron chat client that keeps Hermes dashboard credentials in the Node backend while the renderer talks only to a local gateway proxy.

## Language

**Gateway Reconnect**:
Re-establishing the renderer-to-backend WebSocket connection at `ws://localhost:8765/ws`. It does not mean restarting the watched Hermes dashboard process or exposing the dashboard token to the renderer.
_Avoid_: dashboard reconnect, process restart, token refresh

**Session History**:
A sidebar list of resumable conversation summaries returned by the Hermes gateway. It is not the full message transcript for a session.
_Avoid_: transcript, message log, chat archive
