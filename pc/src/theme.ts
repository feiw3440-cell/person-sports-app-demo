// 主题：国际体育科技风（沿用 APP 品牌体系 #12345B / #2872B8 / #F3F6FA）
import type { ThemeConfig } from 'antd'

export const brandTheme: ThemeConfig = {
  token: {
    colorPrimary: '#12345B',
    colorInfo: '#2872B8',
    colorLink: '#2872B8',
    colorBgLayout: '#F3F6FA',
    colorBgContainer: '#ffffff',
    borderRadius: 8,
    fontSize: 14,
  },
  components: {
    Layout: {
      siderBg: '#12345B',
      headerBg: '#ffffff',
      headerHeight: 56,
    },
    Menu: {
      darkItemBg: 'transparent',
      darkItemSelectedBg: '#2872B8',
      darkItemColor: 'rgba(255,255,255,0.72)',
      darkItemSelectedColor: '#ffffff',
    },
    Card: { borderRadiusLG: 10 },
  },
}

export const STATUS_COLORS: Record<string, string> = {
  // 通用
  active: 'green', draft: 'default', deprecated: 'default',
  // 资质/身份
  submitted: 'processing', under_review: 'processing', approved: 'success', rejected: 'error', resubmitted: 'processing',
  // 课程
  pending_review: 'processing', published: 'success', paused: 'warning', archived: 'default',
  // 报名
  pending: 'processing', cancelled: 'default', completed: 'success',
  // 赛事
  registration_closed: 'warning', in_progress: 'processing',
  // 授权
  revoked: 'error', expired: 'default',
  // 组织成员
  accepted: 'success', declined: 'default',
}

export const STATUS_LABELS: Record<string, string> = {
  draft: '草稿', submitted: '已提交', under_review: '审核中', approved: '已通过', rejected: '已驳回',
  resubmitted: '重新提交', pending_review: '待审核', published: '已发布', paused: '已暂停', archived: '已归档',
  pending: '待处理', cancelled: '已取消', completed: '已完成', registration_closed: '报名截止', in_progress: '进行中',
  revoked: '已撤销', expired: '已到期', active: '生效中', declined: '已婉拒', accepted: '已接受', deprecated: '已停用',
  present: '出勤', absent: '缺勤', leave: '请假',
}
