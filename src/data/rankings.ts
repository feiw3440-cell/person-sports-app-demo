// 登录水合后的服务端榜单快照（ESM 活绑定：水合完成后页面自动读取到最新值）
import type { RankMode } from '../types'
import type { RankingStore, ServerRanking, ServerRankingRow } from '../services/rankings'

const EMPTY_STORE: RankingStore = { athlete: {}, mentor: {} }

export let RANKINGS: RankingStore = EMPTY_STORE

export function hydrateRankings(store: RankingStore): void {
  RANKINGS = store
}

export function resetRankings(): void {
  RANKINGS = EMPTY_STORE
}

export function rankingOf(category: 'athlete' | 'mentor', mode: RankMode): ServerRanking | undefined {
  return RANKINGS[category][mode]
}

export function rankingRows(category: 'athlete' | 'mentor', mode: RankMode): ServerRankingRow[] {
  return (rankingOf(category, mode)?.rows ?? []).map((row) => ({
    ...row,
    // 快照行字段统一：target_id/display_name（兼容旧 entity_id/name 字段名）
    target_id: row.target_id || row.entity_id,
    display_name: row.display_name || row.name,
  }))
}
