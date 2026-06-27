import type { ServerResponse, IncomingMessage } from 'node:http'
import type { PresenceController } from '../presence.js'

/**
 * 发送 JSON 响应。
 */
function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

/**
 * 读取请求 body。
 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString()
      // 限制 body 最大 64KB，防恶意请求
      if (data.length > 64_000) {
        req.destroy()
        reject(new Error('请求体过大'))
      }
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

/**
 * 处理 `POST /api/presence/notify` —— 根据对话上下文生成一句通知文案。
 *
 * 请求体：`{ "context": "最近对话摘要（空字符串表示尚无对话）" }`
 * 响应体：`{ "text": "生成的文案" }`
 *
 * @param req - HTTP 请求对象
 * @param res - 响应对象
 * @param controller - PresenceEngine 控制器
 */
export async function handleNotify(
  req: IncomingMessage,
  res: ServerResponse,
  controller: PresenceController
): Promise<void> {
  try {
    const body = await readBody(req)
    let context = ''
    try {
      const parsed = JSON.parse(body) as { context?: string }
      context = typeof parsed.context === 'string' ? parsed.context : ''
    } catch {
      // body 解析失败时默认为空上下文
    }

    const text = await controller.generateNotify(context)
    json(res, 200, { text })
  } catch (err) {
    console.error('[presence] 通知生成失败:', err instanceof Error ? err.message : err)
    json(res, 500, { error: 'notify_failed' })
  }
}
