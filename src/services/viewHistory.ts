// 浏览历史上报 hook（E-4）：详情页挂载时上报（API 模式；服务端同实体去重，重复浏览刷新 viewed_at）
import { useEffect } from 'react'
import { DATA_SOURCE } from '../data/db'
import { api } from './apiClient'

export type ViewHistoryType = 'content' | 'course' | 'competition' | 'profile' | 'project' | 'org'

export function useViewHistory(targetType: ViewHistoryType, targetId: string | undefined): void {
  useEffect(() => {
    if (DATA_SOURCE !== 'api' || !targetId) return
    api('POST', '/history', { target_type: targetType, target_id: targetId }).catch(() => {
      /* 历史上报失败不打扰浏览（非关键路径） */
    })
  }, [targetType, targetId])
}
