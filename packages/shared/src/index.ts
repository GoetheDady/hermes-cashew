/**
 * @hermes/shared —— 前端、后端共用的 Hermes 网关协议类型。
 *
 * Hermes dashboard 通过 `/api/ws` 暴露 JSON-RPC 2.0 over WebSocket 网关。
 * 这里定义客户端与桥接后端共用的帧、事件与方法返回结构。
 * 协议来源：Hermes 的 tui_gateway/server.py 与 apps/shared/src/json-rpc-gateway.ts。
 */

export * from './message.js'
export * from './tool-events.js'
export * from './history.js'
export * from './gateway.js'
