// 共享 API 榜单：服务端 ranking_snapshot 为权威数据源
// 页面只消费本文件整理后的行数据，不再直接用本地 Mock ID 关联人员
import { api } from './apiClient'
import type { RankCategory, RankMode, Period } from '../types'

export type ServerRankingRow = {
  rank: number
  entity?: string
  entity_id: string
  name: string
  score: number
  delta: number
  note?: string
  verified?: boolean
}

export type ServerRanking = {
  category: string
  mode: string
  period: string
  rows: ServerRankingRow[]
  state: 'ok' | 'updating' | 'empty'
  updated_at?: string | null
  formula?: Record<string, unknown> | null
  source?: string
}

export type RankingStore = {
  athlete: Partial<Record<RankMode, ServerRanking>>
  mentor: Partial<Record<RankMode, ServerRanking>>
}

const EMPTY_RANKING: ServerRanking = {
  category: '',
  mode: '',
  period: 'total',
  rows: [],
  state: 'empty',
  updated_at: null,
}

export async function fetchRanking(category: RankCategory, mode: RankMode, period: Period = 'total'): Promise<ServerRanking> {
  const res = await api<{ data: ServerRanking }>('GET', `/rankings/${category}?mode=${mode}&period=${period}`)
  const data = res.data
  const rawRows = Array.isArray(data?.rows) ? data.rows : []
  // 服务端快照可能未带 rank，或行顺序与分数不一致；统一按 rank（存在时）或分数降序，并补齐名次
  const hasRank = rawRows.length > 0 && rawRows.every((row) => typeof row.rank === 'number')
  const sortedRows = [...rawRows].sort((a, b) => (hasRank ? a.rank - b.rank : b.score - a.score))
  const rows = sortedRows.map((row, index) => ({
    ...row,
    rank: typeof row.rank === 'number' ? row.rank : index + 1,
  }))
  return {
    ...EMPTY_RANKING,
    ...data,
    rows,
  }
}

const JOBS: { category: 'athlete' | 'mentor'; mode: RankMode }[] = [
  { category: 'athlete', mode: 'overall' },
  { category: 'athlete', mode: 'pro' },
  { category: 'athlete', mode: 'popularity' },
  { category: 'mentor', mode: 'overall' },
  { category: 'mentor', mode: 'popularity' },
]

/** 登录水合时并行拉取页面所需榜单；单个榜单失败只返回空快照，不阻断 APP 启动 */
export async function loadRankings(): Promise<RankingStore> {
  const store: RankingStore = { athlete: {}, mentor: {} }
  const results = await Promise.allSettled(JOBS.map((job) => fetchRanking(job.category, job.mode, 'total')))
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const job = JOBS[index]
      store[job.category][job.mode] = result.value
    }
  })
  return store
}
