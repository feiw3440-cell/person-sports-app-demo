// 榜单种子：为 7 类 × 3 模式 × 3 周期生成口径定义与演示快照（幂等：全删重建）
// 口径说明写入 formula（演示口径，正式权重待确认）；快照行标注演示与核验状态

type DB = {
  prepare(sql: string): {
    get(...args: unknown[]): unknown
    all(...args: unknown[]): unknown[]
    run(...args: unknown[]): { changes: number }
  }
}

type Row = { rank: number; target_id: string; display_name: string; score: number; verified: boolean }

function hash01(s: string): number {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 9973
  return h / 9973
}

export function seedRankings(db: DB): void {
  db.prepare('DELETE FROM ranking_snapshots').run()
  db.prepare('DELETE FROM ranking_definitions').run()

  type Src = { id: string; name: string; verified: boolean; base: number; extra: string }

  const athletes = (db.prepare("SELECT p.id, a.display_name, p.verify_status, p.region FROM person_profiles p JOIN accounts a ON a.id = p.account_id WHERE p.kind = 'athlete' ORDER BY p.id").all() as Record<string, string>[]).map((r) => ({
    id: r.id, name: r.display_name, verified: r.verify_status === 'verified', base: 0, extra: r.region || '',
  }))
  const mentors = (db.prepare("SELECT p.id, a.display_name, p.verify_status FROM person_profiles p JOIN accounts a ON a.id = p.account_id WHERE p.kind = 'mentor' ORDER BY p.id").all() as Record<string, string>[]).map((r) => ({
    id: r.id, name: r.display_name, verified: r.verify_status === 'verified', base: 0, extra: '',
  }))
  const projects = (db.prepare("SELECT id, name FROM sports_projects WHERE status = 'active' ORDER BY id").all() as Record<string, string>[]).map((r) => ({
    id: r.id, name: r.name, verified: true, base: 0, extra: '',
  }))
  const courses = (db.prepare("SELECT id, name FROM courses WHERE status = 'published' ORDER BY id").all() as Record<string, string>[]).map((r) => ({
    id: r.id, name: r.name, verified: true, base: 0, extra: '',
  }))
  const events = (db.prepare('SELECT id, name FROM competitions ORDER BY id').all() as Record<string, string>[]).map((r) => ({
    id: r.id, name: r.name, verified: true, base: 0, extra: '',
  }))
  const orgs = (db.prepare("SELECT id, name FROM organizations WHERE status = 'active' ORDER BY id").all() as Record<string, string>[]).map((r) => ({
    id: r.id, name: r.name, verified: true, base: 0, extra: '',
  }))
  // 城市榜：按机构 region 聚合（演示口径）
  const regionCount = new Map<string, number>()
  for (const o of db.prepare("SELECT region FROM organizations WHERE status = 'active'").all() as Record<string, string>[]) {
    regionCount.set(o.region, (regionCount.get(o.region) || 0) + 1)
  }
  const cities = [...regionCount.entries()].map(([region, n], idx) => ({
    id: `city_${region}`, name: region, verified: true, base: 88 - idx * 1.4, extra: `机构 ${n} 家（演示）`,
  }))

  const groups: Record<string, Src[]> = { athlete: athletes, mentor: mentors, project: projects, course: courses, event: events, org: orgs, city: cities }
  const modes = ['overall', 'pro', 'popularity'] as const
  const periods = ['week', 'month', 'total'] as const
  const scale = { week: 0.6, month: 0.8, total: 1 } as const

  const insDef = db.prepare(
    'INSERT INTO ranking_definitions(id, category, mode, formula, period, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
  const insSnap = db.prepare(
    'INSERT INTO ranking_snapshots(id, definition_id, period_key, rows, computed_at) VALUES (?, ?, ?, ?, ?)',
  )
  let seq = 0
  for (const [category, list] of Object.entries(groups)) {
    if (!list.length) continue
    // 演示分数：确定性伪随机基数，保证可复现
    const scored = list.map((it, idx) => ({ ...it, base: it.base || 96 - idx * 1.3 - hash01(it.id) * 2 }))
    for (const mode of modes) {
      const rows: Row[] = scored
        .map((it) => {
          let score = it.base
          if (mode === 'pro') score = it.verified ? it.base + 2 : it.base - 6
          if (mode === 'popularity') score = it.base - 3 + hash01(it.id + mode) * 4
          return { id: it.id, display_name: it.name, score: Math.round(score * 10) / 10, verified: it.verified }
        })
        .sort((a, b) => b.score - a.score)
        .map((r, i) => ({ rank: i + 1, target_id: r.id, display_name: r.display_name, score: r.score, verified: r.verified }))
      for (const period of periods) {
        seq += 1
        const defId = `rd_${String(seq).padStart(3, '0')}`
        const formula =
          mode === 'overall'
            ? { note: '综合榜（演示口径）', weights: { professional: 0.6, influence: 0.4 }, source: '演示种子' }
            : mode === 'pro'
              ? { note: '专业榜（演示口径）', basis: '经核验成绩/资质；未核验数据单独标注', source: '演示种子' }
              : { note: '人气榜（演示口径）', basis: '关注/有效观看/收藏/评论等互动，不单以点赞排序', source: '演示种子' }
        insDef.run(defId, category, mode, JSON.stringify(formula), period, 'active', new Date().toISOString())
        const scaled = rows.map((r) => ({
          ...r,
          score: Math.round(r.score * (period === 'week' ? 0.6 : period === 'month' ? 0.8 : 1) * 10) / 10,
        }))
        insSnap.run(`rs_${defId}`, defId, `${period}-demo`, JSON.stringify(scaled), new Date().toISOString())
      }
    }
  }
  console.log('[seed] 榜单定义与快照已写入（演示口径与演示分数）')
}
