import type { ServerResponse } from 'node:http'
import type { PresenceController } from '../presence.js'

/**
 * 发送 JSON 响应。
 */
function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

/**
 * 处理 `GET /api/presence/prompts` —— 返回 PresenceEngine 当前缓冲的问候语列表。
 *
 * 始终返回 `{ prompts: string[] }`，即使缓冲区为空也会返回内置兜底文案，
 * 前端不需要自行处理空状态。
 *
 * @param _reqUrl - 请求 URL（未使用，保留以匹配路由处理函数签名惯例）
 * @param res - 响应对象
 * @param controller - PresenceEngine 控制器
 */
export function handleGetPrompts(
  _reqUrl: string,
  res: ServerResponse,
  controller: PresenceController
): void {
  try {
    const prompts = controller.getPrompts()
    json(res, 200, { prompts })
  } catch (err) {
    console.error('[presence] 获取提示词失败:', err instanceof Error ? err.message : err)
    json(res, 500, { error: 'presence_failed' })
  }
}
