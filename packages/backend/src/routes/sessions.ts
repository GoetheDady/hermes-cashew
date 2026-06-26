import type { ServerResponse } from 'node:http'
import type { PaginatedSessionListResult, SessionSummary } from '@hermes/shared'
import type DatabaseConstructor from 'better-sqlite3'

/** `better-sqlite3` 的 Database 实例类型。 */
type Database = InstanceType<typeof DatabaseConstructor>

/**
 * 分页查询会话列表。
 *
 * @param db - 只读打开的 Hermes state.db
 * @param offset - 偏移量（默认 0）
 * @param limit - 每页条数（默认 50，上限 200）
 * @returns 分页结果
 */
function querySessions(
  db: Database,
  offset: number,
  limit: number
): PaginatedSessionListResult {
  const countRow = db
    .prepare('SELECT COUNT(*) AS total FROM sessions')
    .get() as { total: number }
  const total = countRow.total

  const rows = db
    .prepare(
      `SELECT
        s.id,
        s.title,
        s.started_at,
        s.message_count,
        s.source,
        (SELECT substr(m.content, 1, 200) FROM messages m
         WHERE m.session_id = s.id AND m.role = 'user'
         ORDER BY m.timestamp ASC LIMIT 1) AS preview
      FROM sessions s
      ORDER BY s.started_at DESC
      LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as Array<{
    id: string
    title: string | null
    started_at: number
    message_count: number
    source: string
    preview: string | null
  }>

  const sessions: SessionSummary[] = rows.map((r) => ({
    id: r.id,
    title: r.title?.trim() || '',
    preview: r.preview?.trim() || '',
    started_at: r.started_at,
    message_count: r.message_count ?? 0,
    source: r.source ?? ''
  }))

  return { sessions, total, offset, limit }
}

/**
 * 发送 JSON 响应。
 */
function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

/**
 * 处理 `GET /api/sessions` —— 分页返回 Hermes 会话列表。
 *
 * @param reqUrl - 请求 URL
 * @param res - 响应对象
 * @param db - 只读 state.db 实例（null 时返回空列表）
 */
export function handleListSessions(
  reqUrl: string,
  res: ServerResponse,
  db: Database | null
): void {
  if (!db) {
    json(res, 200, { sessions: [], total: 0, offset: 0, limit: 0 })
    return
  }

  const url = new URL(reqUrl, 'http://localhost')
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0)
  const limit = Math.min(
    200,
    Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10) || 50)
  )

  try {
    const result = querySessions(db, offset, limit)
    json(res, 200, result)
  } catch (err) {
    console.error('[sessions] 查询失败:', err instanceof Error ? err.message : err)
    json(res, 500, { error: 'query_failed' })
  }
}
