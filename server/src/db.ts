// 数据库：打开、迁移、辅助读取
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../data/app.db')

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

/** 启动门禁：按 schema_migrations 顺序应用未执行的迁移；失败拒绝启动 */
export function runMigrations(): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`)
  const dir = path.resolve(__dirname, '../db/migrations')
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: string }[]).map((r) => r.version),
  )
  const ran: string[] = []
  for (const file of files) {
    if (applied.has(file)) continue
    const sql = fs.readFileSync(path.join(dir, file), 'utf8')
    try {
      const tx = db.transaction(() => {
        db.exec(sql)
        db.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(file, new Date().toISOString())
      })
      tx()
      ran.push(file)
    } catch (e) {
      // 迁移失败：拒绝启动，不半跑（事务已保证单文件原子性）
      throw new Error(`迁移 ${file} 失败：${(e as Error).message}`)
    }
  }
  return ran
}

export function kvGet(key: string): string | undefined {
  const row = db.prepare('SELECT value FROM kv_meta WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value
}

export function kvSet(key: string, value: string): void {
  db.prepare('INSERT INTO kv_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}

/** 权限版本：角色/成员关系/授权变更时递增，客户端凭此判断权限上下文是否过期 */
export function bumpPermVersion(): number {
  const next = Number(kvGet('perm_version') || '1') + 1
  kvSet('perm_version', String(next))
  return next
}

export function getPermVersion(): number {
  return Number(kvGet('perm_version') || '1')
}
