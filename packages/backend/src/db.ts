import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import DatabaseConstructor from 'better-sqlite3'

/** `better-sqlite3` 的 Database 实例类型。 */
type Database = InstanceType<typeof DatabaseConstructor>

/**
 * 以只读模式打开 Hermes 的 state.db。
 *
 * 默认路径 `~/.hermes/state.db`，可通过环境变量 `HERMES_STATE_DB_PATH` 覆盖。
 * 若文件不存在则返回 `null`（调用方自行处理空状态）。
 *
 * @returns 只读 Database 实例；state.db 不存在时返回 null
 */
export function openStateDb(): Database | null {
  const dbPath =
    process.env.HERMES_STATE_DB_PATH ?? join(homedir(), '.hermes', 'state.db')

  if (!existsSync(dbPath)) {
    console.warn(`[db] state.db 不存在：${dbPath}，会话列表将为空`)
    return null
  }

  const db = new DatabaseConstructor(dbPath, { readonly: true })
  db.pragma('journal_mode=WAL')
  console.log(`[db] 已只读打开 ${dbPath}`)
  return db
}
