// 数据库维护命令：migrate / rollback / reset / backup（备份门禁：不可逆操作前必须先备份）
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { db, DB_PATH, runMigrations } from './db'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * WAL 模式下的一致性备份：使用 SQLite 官方在线备份 API（better-sqlite3 db.backup），
 * 不再直接 copyFileSync 主库文件（那样会漏掉尚未 checkpoint 的 WAL 内容）。
 * 备份完成后对新文件执行 PRAGMA integrity_check，失败则不声称备份成功。
 */
async function backup(): Promise<string> {
  const dir = path.resolve(__dirname, '../data/backups')
  fs.mkdirSync(dir, { recursive: true })
  const base = path.join(dir, `app-${new Date().toISOString().replace(/[:.]/g, '-')}.db`)
  let target = base
  let seq = 2
  while (fs.existsSync(target)) target = base.replace(/\.db$/, `-${seq++}.db`) // 不覆盖已有备份

  await db.backup(target)
  const verify = new Database(target, { readonly: true, fileMustExist: true })
  const result = String(verify.pragma('integrity_check', { simple: true }))
  verify.close()
  if (result !== 'ok') throw new Error(`备份完整性校验失败：${result}`)
  console.log(`[backup] ${DB_PATH} → ${target}（SQLite online backup；integrity_check=${result}）`)
  return target
}

const cmd = process.argv[2]
switch (cmd) {
  case 'migrate': {
    const ran = runMigrations()
    console.log(ran.length ? `[migrate] 应用迁移：${ran.join(', ')}` : '[migrate] 无待应用迁移')
    break
  }
  case 'rollback': {
    const dir = path.resolve(__dirname, '../db/migrations/down')
    const applied = (db.prepare('SELECT version FROM schema_migrations ORDER BY applied_at DESC').all() as { version: string }[])
    const last = applied.find((r) => fs.existsSync(path.join(dir, r.version.replace('.sql', '.down.sql'))))
    if (!last) {
      console.log('[rollback] 无可回滚迁移')
      break
    }
    await backup()
    const sql = fs.readFileSync(path.join(dir, last.version.replace('.sql', '.down.sql')), 'utf8')
    db.transaction(() => {
      db.exec(sql)
      db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(last.version)
    })()
    console.log(`[rollback] 已回滚 ${last.version}（先备份）`)
    break
  }
  case 'backup': {
    await backup()
    break
  }
  case 'reset': {
    await backup()
    // 同连接内重建：执行 down 全量删表 → 重放迁移 → 灌种子（避免重开连接）
    const downSql = fs.readFileSync(path.resolve(__dirname, '../db/migrations/down/001_init.down.sql'), 'utf8')
    db.exec(downSql)
    runMigrations()
    const { seed } = await import('../db/seed/seed')
    seed()
    console.log('[reset] 数据库已重建并灌入演示种子')
    break
  }
  default:
    console.log('用法：tsx src/db-cli.ts <migrate|rollback|backup|reset>')
}
