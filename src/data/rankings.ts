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
  return rankingOf(category, mode)?.rows ?? []
}
