// 数据库维护命令：migrate / rollback / reset / backup（备份门禁：不可逆操作前必须先备份）
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, DB_PATH, runMigrations } from './db'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function backup(): string {
  const dir = path.resolve(__dirname, '../data/backups')
  fs.mkdirSync(dir, { recursive: true })
  const target = path.join(dir, `app-${new Date().toISOString().replace(/[:.]/g, '-')}.db`)
  fs.copyFileSync(DB_PATH, target)
  console.log(`[backup] ${DB_PATH} → ${target}`)
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
    backup()
    const sql = fs.readFileSync(path.join(dir, last.version.replace('.sql', '.down.sql')), 'utf8')
    db.transaction(() => {
      db.exec(sql)
      db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(last.version)
    })()
    console.log(`[rollback] 已回滚 ${last.version}（先备份）`)
    break
  }
  case 'backup': {
    backup()
    break
  }
  case 'reset': {
    backup()
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
