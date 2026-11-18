// 导师卡片视图模型：服务端导师榜优先，其次当前数据范围内可见导师档案，最后使用真实师徒关系。
// API 模式不会回退到本地 Mock 导师 ID；无数据时由页面展示空状态。
import { MENTORSHIPS, USERS, userById } from '../data/db'
import { rankingRows } from '../data/rankings'
import type { RankMode, User } from '../types'

export type MentorCardData = {
  id: string
  name: string
  color: string
  photo?: string
  title?: string
  level?: string
  verify?: User['verify']
  score?: number
  hasProfile: boolean
  source: 'ranking' | 'profile' | 'mentorship'
}

const FALLBACK_COLOR = '#12345B'

export function mentorCards(mode: RankMode = 'overall', limit = 3): MentorCardData[] {
  const rows = rankingRows('mentor', mode)
  if (rows.length > 0) {
    return rows.slice(0, limit).map((row) => {
      const user = userById(row.entity_id)
      return {
        id: row.entity_id,
        name: user?.name || row.name,
        color: user?.color || FALLBACK_COLOR,
        photo: user?.photo,
        title: user?.title,
        level: user?.mentorInfo?.level,
        verify: user?.verify,
        score: row.score,
        hasProfile: !!user,
        source: 'ranking',
      }
    })
  }

  const profiles = USERS.filter((user) => user.kind === 'mentor')
  if (profiles.length > 0) {
    return profiles.slice(0, limit).map((user) => ({
      id: user.id,
      name: user.name,
      color: user.color || FALLBACK_COLOR,
      photo: user.photo,
      title: user.title,
      level: user.mentorInfo?.level,
      verify: user.verify,
      hasProfile: true,
      source: 'profile',
    }))
  }

  const seen = new Set<string>()
  const cards: MentorCardData[] = []
  for (const mentorship of MENTORSHIPS) {
    if (!mentorship.mentorId || seen.has(mentorship.mentorId)) continue
    seen.add(mentorship.mentorId)
    cards.push({
      id: mentorship.mentorId,
      name: mentorship.mentorName || '导师',
      color: FALLBACK_COLOR,
      title: '与你建立师徒关系',
      hasProfile: false,
      source: 'mentorship',
    })
    if (cards.length >= limit) break
  }
  return cards
}
