// 专体 PERSON SPORTS · 本地模拟数据库
// ⚠️ 全部账号、成绩、认证、排名、互动数据均为“演示模拟数据”，不代表任何真实人物或事实。
import type {
  Authorization,
  Competition,
  ContentItem,
  Course,
  Mentorship,
  Metrics,
  MsgItem,
  Organization,
  PodiumItem,
  RankEntity,
  RoleRecord,
  SportsProject,
  Trend,
  User,
} from '../types'

export const IS_MOCK = true

function m(
  prof: number,
  influence: number,
  views: number,
  likes: number,
  favs: number,
  comments: number,
  follows: number,
): Metrics {
  return { prof, influence, views, likes, favs, comments, follows }
}
function t(week: number, month: number, total: number): Trend {
  return { week, month, total }
}

/* ============ 角色（身份）定义 ============ */
// 身份 = 账号自身属性，与师徒/授权关系分离（PRD §7.3）
export const ROLES: RoleRecord[] = [
  { id: 'r-regular', type: 'regular', label: '普通用户', status: 'active' },
  { id: 'r-student', type: 'student', label: '学员', status: 'active', extra: '师从徐峰·摔跤入门（演示）' },
  { id: 'r-athlete', type: 'athlete', label: '运动员', status: 'active', extra: '业余摔跤·成绩未核验（演示）' },
  { id: 'r-coach', type: 'coach', label: '教练（授权教练）', status: 'active', extra: '获徐峰摔跤启蒙教学授权（演示）' },
  { id: 'r-org', type: 'org', label: '机构工作人员', status: 'active', extra: '锋跃摔跤俱乐部（演示）' },
  { id: 'r-admin', type: 'admin', label: '体育管理角色', status: 'active', extra: '授权范围：摔跤/柔道·华东（演示）' },
]

export const SELF_ID = 'u0'

export const ROLE_LABEL: Record<string, string> = {
  regular: '普通用户',
  student: '学员',
  athlete: '运动员',
  coach: '教练',
  mentor: '导师',
  org: '机构人员',
  admin: '管理角色',
}

/* ============ 用户 ============ */
export const USERS: User[] = [
  {
    id: 'u0',
    name: '阿体',
    color: '#2872B8',
    kind: 'self',
    roles: ['regular', 'student', 'athlete', 'coach', 'org', 'admin'],
    verify: 'pending',
    region: '上海',
    title: '演示账号',
    bio: '这是专体的演示账号，用于展示多身份切换、师徒授权等交互原型。',
    photo: 'img/me_avatar.jpg',
    followers: 328,
  },
  {
    id: 'a1',
    name: '林昊',
    color: '#FF6B5E',
    kind: 'athlete',
    roles: ['athlete'],
    verify: 'verified',
    region: '上海',
    title: '摔跤运动员',
    bio: '专注自由式摔跤，希望把赛场经验分享给更多年轻选手。',
    followers: 128400,
    achievements: [
      { name: '全国锦标赛男子自由式68kg冠军', date: '2025-10', unverified: false },
      { name: '全国U20摔跤赛亚军', date: '2024-09', unverified: false },
    ],
    career: [
      { year: '2021', text: '入选省专业队（演示）' },
      { year: '2018', text: '全国青年摔跤锦标赛出道（演示）' },
    ],
  },
  {
    id: 'a2',
    name: '陈一诺',
    color: '#19B9AC',
    kind: 'athlete',
    roles: ['athlete'],
    verify: 'verified',
    region: '杭州',
    title: '柔道运动员',
    followers: 86500,
    achievements: [{ name: '全国青年杯女子52kg亚军', date: '2025-05', unverified: false }],
    career: [{ year: '2022', text: '进入省柔道队（演示）' }],
  },
  {
    id: 'a3',
    name: '周子昂',
    color: '#8B5CF6',
    kind: 'athlete',
    roles: ['athlete'],
    verify: 'verified',
    region: '南京',
    title: '田径运动员 · 110米栏',
    followers: 52100,
    achievements: [{ name: '省运会110米栏季军', date: '2024-11', unverified: false }],
    career: [{ year: '2020', text: '市体校田径队（演示）' }],
  },
  {
    id: 'a4',
    name: '苏芮',
    color: '#2B7FFF',
    kind: 'athlete',
    roles: ['athlete'],
    verify: 'unverified',
    region: '上海',
    title: '游泳运动员',
    followers: 12400,
    achievements: [{ name: '市游泳冠军赛女子100米仰泳第五名', date: '2025-08', unverified: true }],
  },
  {
    id: 'a5',
    name: '郑飞',
    color: '#FF9850',
    kind: 'athlete',
    roles: ['athlete'],
    verify: 'verified',
    region: '成都',
    title: '篮球运动员 · 后卫',
    followers: 43800,
    achievements: [{ name: '城市篮球联赛得分王（演示）', date: '2025-03', unverified: false }],
  },
  {
    id: 'a6',
    name: '韩雪',
    color: '#6366F1',
    kind: 'athlete',
    roles: ['athlete'],
    verify: 'appealing',
    region: '北京',
    title: '击剑运动员 · 花剑',
    followers: 21700,
    achievements: [{ name: '全国击剑冠军赛分站赛八强', date: '2025-06', unverified: true }],
  },
  {
    id: 'a7',
    name: '陆遥',
    color: '#EC4899',
    kind: 'athlete',
    roles: ['athlete'],
    verify: 'verified',
    region: '成都',
    title: '攀岩运动员',
    followers: 18900,
    achievements: [{ name: '全国攀岩联赛难度赛决赛入围（演示）', date: '2025-04', unverified: false }],
  },
  {
    id: 'a8',
    name: '何雨薇',
    color: '#22C55E',
    kind: 'athlete',
    roles: ['athlete'],
    verify: 'verified',
    region: '广州',
    title: '羽毛球运动员',
    followers: 27600,
    achievements: [{ name: '省大学生羽毛球锦标赛女单冠军（演示）', date: '2024-12', unverified: false }],
  },
  {
    id: 'm1',
    name: '徐峰',
    color: '#12345B',
    kind: 'mentor',
    roles: ['coach', 'mentor'],
    verify: 'verified',
    region: '上海',
    title: '摔跤导师',
    bio: '前专业队摔跤运动员，退役后专注青少年摔跤培养与教练员授权体系建设。',
    followers: 35600,
    mentorInfo: {
      level: '体系导师（占位名称·规则待确认）',
      since: '2015',
      system: '摔跤青少年培养五段体系（演示）：基础身体控制 → 倒地自我保护 → 站姿与抱摔 → 条件实战 → 比赛策略。',
      philosophy: '以基本功与身体控制为先，先学会安全地摔倒，再学会摔倒别人。',
      studentCount: 46,
    },
  },
  {
    id: 'm2',
    name: '罗兰',
    color: '#0E7C72',
    kind: 'mentor',
    roles: ['coach', 'mentor'],
    verify: 'verified',
    region: '杭州',
    title: '柔道导师',
    followers: 21400,
    mentorInfo: {
      level: '高级导师（占位名称·规则待确认）',
      since: '2018',
      system: '柔道技战术分解教学（演示）：动作拆解 → 条件代入 → 实战复盘。',
      philosophy: '以柔克刚，借力打力；先把受身练扎实，再谈技术。',
      studentCount: 32,
    },
  },
  {
    id: 'm3',
    name: '高翔',
    color: '#7C4DFF',
    kind: 'mentor',
    roles: ['coach', 'mentor'],
    verify: 'verified',
    region: '南京',
    title: '田径导师 · 短跨',
    followers: 16800,
    mentorInfo: {
      level: '认证导师（占位名称·规则待确认）',
      since: '2019',
      system: '短跨爆发力训练模块（演示）：起动 → 节奏 → 末段冲刺。',
      philosophy: '栏架不是障碍，是节奏的标点。',
      studentCount: 25,
    },
  },
  {
    id: 'm4',
    name: '温静',
    color: '#1565C0',
    kind: 'mentor',
    roles: ['coach', 'mentor'],
    verify: 'verified',
    region: '上海',
    title: '游泳导师',
    followers: 19300,
    mentorInfo: {
      level: '认证导师（占位名称·规则待确认）',
      since: '2020',
      system: '成人零基础四泳姿进阶（演示）。',
      philosophy: '先不怕水，再谈泳姿。',
      studentCount: 58,
    },
  },
  {
    id: 'm5',
    name: '石磊',
    color: '#E65100',
    kind: 'mentor',
    roles: ['coach', 'mentor'],
    verify: 'verified',
    region: '成都',
    title: '篮球导师',
    followers: 14100,
    mentorInfo: {
      level: '认证导师（占位名称·规则待确认）',
      since: '2021',
      system: '控球与比赛阅读训练（演示）。',
      philosophy: '运球是篮球的语言，先学会说话。',
      studentCount: 30,
    },
  },
  {
    id: 'm6',
    name: '白帆',
    color: '#3949AB',
    kind: 'mentor',
    roles: ['coach', 'mentor'],
    verify: 'verified',
    region: '北京',
    title: '击剑导师 · 花剑',
    followers: 9800,
    mentorInfo: {
      level: '认证导师（占位名称·规则待确认）',
      since: '2022',
      system: '击剑启蒙步伐与距离感课程（演示）。',
      philosophy: '击剑是身体的国际象棋。',
      studentCount: 18,
    },
  },
  { id: 's1', name: '小李', color: '#00897B', kind: 'student', roles: ['student'], verify: 'pending', region: '上海', title: '学员（演示）' },
  { id: 's2', name: '小周', color: '#7E57C2', kind: 'student', roles: ['student'], verify: 'pending', region: '上海', title: '学员（演示）' },
  // —— 高保真原型新增演示人物（头像取自原型图裁切） ——
  { id: 'nw1', name: '张伟', color: '#0D48C0', kind: 'athlete', roles: ['athlete'], verify: 'verified', region: '北京', title: '摔跤运动员 · 国家队', photo: 'img/top_av_1.jpg', followers: 236000, achievements: [{ name: '世界摔跤锦标赛洲际冠军（模拟）', date: '2025-09', unverified: false }] },
  { id: 'nw2', name: '李明阳', color: '#2E6BE6', kind: 'athlete', roles: ['athlete'], verify: 'verified', region: '北京', title: '摔跤运动员 · 国家队', photo: 'img/top_av_2.jpg', followers: 158000, achievements: [{ name: '全国摔跤锦标赛冠军（模拟）', date: '2025-05', unverified: false }] },
  { id: 'nw3', name: '王芳', color: '#E65100', kind: 'athlete', roles: ['athlete'], verify: 'verified', region: '上海', title: '游泳运动员 · 国家队', photo: 'img/top_av_3.jpg', followers: 142000, achievements: [{ name: '全国游泳冠军赛金牌（模拟）', date: '2025-04', unverified: false }] },
  { id: 'nw4', name: '李娜', color: '#1565C0', kind: 'athlete', roles: ['athlete'], verify: 'verified', region: '上海', title: '游泳运动员 · 自由泳', photo: 'img/disc_m2.jpg', followers: 96000 },
  { id: 'nw5', name: '王强', color: '#E65100', kind: 'athlete', roles: ['athlete'], verify: 'verified', region: '成都', title: '篮球运动员 · 后卫', photo: 'img/disc_m1.jpg', followers: 88000 },
  { id: 'nm1', name: '刘教练', color: '#12345B', kind: 'mentor', roles: ['coach', 'mentor'], verify: 'verified', region: '北京', title: '摔跤导师', photo: 'img/top_m1.jpg', followers: 62000, mentorInfo: { level: '高级导师（占位名称·规则待确认）', since: '2016', system: '摔跤力量与技巧融合训练体系（演示）', philosophy: '力量是基础，技巧是艺术。', studentCount: 52 } },
  { id: 'nm2', name: '陈教练', color: '#1565C0', kind: 'mentor', roles: ['coach', 'mentor'], verify: 'verified', region: '上海', title: '游泳导师', photo: 'img/top_m2.jpg', followers: 48000, mentorInfo: { level: '认证导师（占位名称·规则待确认）', since: '2019', system: '竞技游泳技术优化课程（演示）', philosophy: '水感优先，效率致胜。', studentCount: 40 } },
  { id: 'nm3', name: '赵教练', color: '#7C4DFF', kind: 'mentor', roles: ['coach', 'mentor'], verify: 'verified', region: '北京', title: '田径导师', photo: 'img/top_m3.jpg', followers: 39000, mentorInfo: { level: '认证导师（占位名称·规则待确认）', since: '2020', system: '短跑爆发力与节奏训练（演示）', philosophy: '每一步都在靠近终点。', studentCount: 28 } },
  { id: 'nm4', name: '王教练', color: '#2872B8', kind: 'mentor', roles: ['coach', 'mentor'], verify: 'verified', region: '北京', title: '摔跤专项教练', photo: 'img/disc_m1.jpg', followers: 28000, mentorInfo: { level: '认证导师（占位名称·规则待确认）', since: '2021', system: '摔跤专项体能与技术课程（演示）', philosophy: '垫上每一秒都算数。', studentCount: 22 } },
  { id: 'nm5', name: '李导师', color: '#0E7C72', kind: 'mentor', roles: ['coach', 'mentor'], verify: 'verified', region: '青岛', title: '柔道教学专家', photo: 'img/disc_m2.jpg', followers: 31000, mentorInfo: { level: '认证导师（占位名称·规则待确认）', since: '2018', system: '柔道教学专家课程体系（演示）', philosophy: '以柔克刚，礼始礼终。', studentCount: 35 } },
  { id: 'nm6', name: '张教练', color: '#1565C0', kind: 'mentor', roles: ['coach', 'mentor'], verify: 'verified', region: '上海', title: '游泳训练专家', photo: 'img/disc_m3.jpg', followers: 26000, mentorInfo: { level: '高级导师（占位名称·规则待确认）', since: '2017', system: '游泳训练专家四泳姿进阶（演示）', philosophy: '先会水，再谈快。', studentCount: 45 } },
  { id: 'acc1', name: '专体官方', color: '#0765FE', kind: 'account', roles: [], verify: 'verified', region: '北京', title: '专体官方账号' },
  { id: 'acc2', name: '国家柔道队', color: '#0D48C0', kind: 'account', roles: [], verify: 'verified', region: '北京', title: '国家队官方账号' },
  { id: 'acc3', name: '游泳训练营', color: '#19B9AC', kind: 'account', roles: [], verify: 'verified', region: '上海', title: '训练机构账号' },
  { id: 'acc4', name: '田径教练李教练', color: '#7C4DFF', kind: 'account', roles: [], verify: 'verified', region: '南京', title: '田径教练账号' },
]

export function userById(id: string): User | undefined {
  return USERS.find((u) => u.id === id)
}

/* ============ 体育项目 ============ */
export const PROJECTS: SportsProject[] = [
  {
    id: 'p1', name: '摔跤', colorA: '#FF6B5E', colorB: '#FF9850', category: '对抗格斗',
    tags: ['力量', '技巧与速度', '竞技'],
    intro: '摔跤是最古老的竞技运动之一，考验力量、技巧与意志。从站姿、倒地自我保护开始，逐步进入抱摔与实战技术。',
    starter: ['第一步：学习安全倒地与自我保护', '第二步：掌握基础站姿与步伐', '第三步：抱腿与转移技术（演示说明）'],
    region: '全国', metrics: m(88, 92, 1200000, 86000, 32000, 12400, 42800), trend: t(2, 1, 3),
  },
  {
    id: 'p2', name: '柔道', colorA: '#19B9AC', colorB: '#0EA5E9', category: '对抗格斗',
    tags: ['以柔克刚', '礼始礼终', '竞技'],
    intro: '柔道讲究"以柔克刚、借力打力"，强调礼始礼终。入门从受身（安全倒地）开始，再学习投技与寝技。',
    starter: ['第一步：受身练习（安全倒地）', '第二步：基础投技·大外刈', '第三步：寝技与压制（演示说明）'],
    region: '全国', metrics: m(85, 84, 980000, 64000, 25000, 9100, 33500), trend: t(0, 2, 1),
  },
  {
    id: 'p3', name: '田径', colorA: '#8B5CF6', colorB: '#6366F1', category: '体能基础',
    tags: ['跑跳投', '运动之母', '大众参与'],
    intro: '田径是运动之母，涵盖跑、跳、投等基础运动能力，也是几乎所有项目的基础体能来源。',
    starter: ['第一步：跑姿与呼吸节奏', '第二步：基础力量与核心', '第三步：专项选择（短跑/跨栏/跳跃）（演示说明）'],
    region: '全国', metrics: m(82, 90, 1500000, 102000, 38000, 15600, 51000), trend: t(1, 0, 2),
  },
  {
    id: 'p4', name: '游泳', colorA: '#2B7FFF', colorB: '#19B9AC', category: '水上运动',
    tags: ['四种泳姿', '生存技能', '低冲击'],
    intro: '游泳既是竞技运动，也是重要的生存技能。四种泳姿：自由泳、仰泳、蛙泳、蝶泳。',
    starter: ['第一步：熟悉水性·憋气与漂浮', '第二步：打腿与换气', '第三步：完整泳姿配合（演示说明）'],
    region: '全国', metrics: m(80, 86, 1100000, 73000, 29000, 10800, 39000), trend: t(-1, 1, 1),
  },
  {
    id: 'p5', name: '篮球', colorA: '#FF9850', colorB: '#FFB547', category: '球类',
    tags: ['团队', '大众参与', '观赏性强'],
    intro: '集体球类项目的代表，强调团队配合、身体对抗与战术阅读，参与门槛低、普及度高。',
    starter: ['第一步：运球与控球', '第二步：传球与跑位', '第三步：投篮与实战（演示说明）'],
    region: '全国', metrics: m(78, 94, 1800000, 130000, 46000, 21000, 62000), trend: t(3, 2, 2),
  },
  {
    id: 'p6', name: '羽毛球', colorA: '#22C55E', colorB: '#84CC16', category: '球类',
    tags: ['全民', '速度', '技巧'],
    intro: '国内参与人数最多的球类项目之一，对步伐、手腕技巧和反应速度要求较高。',
    starter: ['第一步：握拍与挥拍', '第二步：基础步伐', '第三步：高远球与吊球（演示说明）'],
    region: '全国', metrics: m(76, 88, 1350000, 91000, 34000, 14200, 47000), trend: t(1, 1, 0),
  },
  {
    id: 'p7', name: '击剑', colorA: '#6366F1', colorB: '#8B5CF6', category: '对抗格斗',
    tags: ['策略', '优雅', '距离感'],
    intro: '被称为"身体的国际象棋"，强调策略、节奏与距离感，分花剑、重剑、佩剑三个剑种。',
    starter: ['第一步：实战姿势与步伐', '第二步：直刺与防守', '第三步：条件实战（演示说明）'],
    region: '全国', metrics: m(74, 70, 520000, 28000, 11000, 4600, 15200), trend: t(0, -1, 1),
  },
  {
    id: 'p8', name: '攀岩', colorA: '#EC4899', colorB: '#F43F5E', category: '极限运动',
    tags: ['攀爬', '核心力量', ' problem solving'],
    intro: '奥运会正式项目，分为难度、速度与攀石，锻炼全身协调与核心力量。',
    starter: ['第一步：基础攀登动作与安全', '第二步：脚法与重心移动', '第三步：路线阅读（演示说明）'],
    region: '全国', metrics: m(72, 76, 640000, 41000, 16000, 6200, 21000), trend: t(2, 2, 1),
  },
]

export function projectById(id: string) {
  return PROJECTS.find((p) => p.id === id)
}

/* ============ 内容 ============ */
export const CONTENTS: ContentItem[] = [
  { id: 'c1', type: 'video', title: '摔跤训练现场：抱腿转移技术拆解', colorA: '#FF6B5E', colorB: '#FF9850', projectId: 'p1', authorId: 'a1', publishAt: '2026-11-10', duration: '08:24', summary: '专业队训练课片段，慢动作拆解抱腿转移的重心与发力顺序。', metrics: m(90, 88, 324000, 42000, 12600, 2100, 0) },
  { id: 'c2', type: 'video', title: '柔道动作拆解：大外刈的三个关键点', colorA: '#19B9AC', colorB: '#0EA5E9', projectId: 'p2', authorId: 'm2', publishAt: '2026-11-08', duration: '12:06', summary: '罗兰导师讲解大外刈的支撑脚、上手控制与转体时机。', metrics: m(88, 82, 218000, 31000, 9800, 1600, 0) },
  { id: 'c3', type: 'article', title: '年轻运动员训练日记：110米栏的365天', colorA: '#8B5CF6', colorB: '#6366F1', projectId: 'p3', authorId: 'a3', publishAt: '2026-11-05', summary: '从冬训到赛季，一名青年跨栏选手的完整训练周期记录。', metrics: m(84, 76, 96000, 12300, 4300, 890, 0) },
  { id: 'c4', type: 'video', title: '导师教你基础技术：摔跤站姿与步伐', colorA: '#12345B', colorB: '#2872B8', projectId: 'p1', authorId: 'm1', publishAt: '2026-11-02', duration: '15:40', summary: '徐峰导师示范摔跤基础站姿、重心控制与基础步伐。', metrics: m(92, 80, 156000, 18900, 7600, 1200, 0) },
  { id: 'c5', type: 'video', title: '青少年摔跤公开体验课回顾', colorA: '#FF8066', colorB: '#FFB547', projectId: 'p1', authorId: 'm1', publishAt: '2026-10-28', duration: '05:12', summary: '锋跃摔跤俱乐部青少年体验课现场，看孩子们第一次上垫子。', metrics: m(76, 68, 62000, 8100, 2200, 460, 0) },
  { id: 'c6', type: 'video', title: '游泳呼吸技巧分解：换气不再呛水', colorA: '#2B7FFF', colorB: '#19B9AC', projectId: 'p4', authorId: 'm4', publishAt: '2026-10-25', duration: '09:58', summary: '温静导师拆解自由泳换气的头部动作与时机。', metrics: m(82, 72, 108000, 14200, 5100, 780, 0) },
  { id: 'c7', type: 'article', title: '从零开始认识柔道：礼始礼终的文化', colorA: '#0E7C72', colorB: '#22C55E', projectId: 'p2', authorId: 'm2', publishAt: '2026-10-21', summary: '柔道不仅是一项运动，更是一种礼仪与哲学。', metrics: m(78, 64, 45000, 6300, 2600, 410, 0) },
  { id: 'c8', type: 'video', title: '田径爆发力训练三要素', colorA: '#7C4DFF', colorB: '#EC4899', projectId: 'p3', authorId: 'm3', publishAt: '2026-10-18', duration: '11:22', summary: '起动、节奏、末段冲刺——短跨项目的爆发力框架。', metrics: m(86, 74, 132000, 17600, 6200, 940, 0) },
  { id: 'c9', type: 'article', title: '运动员的一天：从清晨6点的垫上开始', colorA: '#0EA5E9', colorB: '#19B9AC', projectId: 'p2', authorId: 'a2', publishAt: '2026-10-15', summary: '记录柔道运动员陈一诺普通一天的训练与恢复。', metrics: m(80, 70, 58000, 9200, 3100, 660, 0) },
  { id: 'c10', type: 'video', title: '击剑入门：实战姿势与基础步伐', colorA: '#3949AB', colorB: '#6366F1', projectId: 'p7', authorId: 'm6', publishAt: '2026-10-12', duration: '10:36', summary: '白帆导师示范击剑实战姿势、前进后退与弓步。', metrics: m(84, 60, 38000, 5100, 1900, 320, 0) },
  { id: 'c11', type: 'video', title: '篮球基础：控球手感十分钟练习', colorA: '#FF9850', colorB: '#FFB547', projectId: 'p5', authorId: 'm5', publishAt: '2026-10-09', duration: '10:10', summary: '石磊导师的每日控球训练菜单，在家也能练。', metrics: m(78, 78, 166000, 21400, 7800, 1300, 0) },
  { id: 'c12', type: 'article', title: '攀岩安全入门：保护与沟通口令', colorA: '#EC4899', colorB: '#F43F5E', projectId: 'p8', authorId: 'a7', publishAt: '2026-10-06', summary: '攀登前的保护检查与"起飞/收紧"口令，安全永远第一。', metrics: m(76, 62, 41000, 5600, 2100, 380, 0) },
  { id: 'c13', type: 'video', title: '羽毛球步法练习：米字步详解', colorA: '#22C55E', colorB: '#84CC16', projectId: 'p6', authorId: 'a8', publishAt: '2026-10-03', duration: '07:45', summary: '何雨薇示范羽毛球基础米字步与重心还原。', metrics: m(80, 72, 88000, 11400, 4200, 690, 0) },
  // —— 发现页瀑布流（高保真原型内容，封面取自原型图裁切） ——
  { id: 'd1', type: 'video', title: '摔跤：力量与技巧的完美结合', colorA: '#0D48C0', colorB: '#22518F', projectId: 'p1', authorId: 'acc1', publishAt: '2026-11-12', duration: '05:30', summary: '摔跤是力量与技巧的完美结合，走近国家队的训练日常。', photo: 'img/disc_wrestle.jpg?v=2', hot: true, cats: ['奥运项目', '格斗对抗'], metrics: m(92, 90, 1285000, 126000, 38000, 8200, 0) },
  { id: 'd2', type: 'video', title: '柔道：以柔克刚的智慧', colorA: '#1565C0', colorB: '#0E7C72', projectId: 'p2', authorId: 'acc2', publishAt: '2026-11-10', duration: '06:12', summary: '柔道的智慧：不与对手拼力，而是借力打力。', photo: 'img/disc_judo.jpg?v=2', cats: ['奥运项目', '格斗对抗'], metrics: m(88, 82, 862000, 83000, 26000, 5400, 0) },
  { id: 'd3', type: 'video', title: '游泳：速度与耐力的较量', colorA: '#2B7FFF', colorB: '#1565C0', projectId: 'p4', authorId: 'acc3', publishAt: '2026-11-08', duration: '04:48', summary: '速度与耐力的较量，自由泳的技术细节全解析。', photo: 'img/disc_swim.jpg?v=2', cats: ['奥运项目', '水上运动'], metrics: m(85, 78, 648000, 67000, 21000, 4100, 0) },
  { id: 'd4', type: 'video', title: '田径：突破极限，挑战自我', colorA: '#7C4DFF', colorB: '#E65100', projectId: 'p3', authorId: 'acc4', publishAt: '2026-11-06', duration: '05:05', summary: '每一次冲刺都是对自我的突破，田径的魅力就在于此。', photo: 'img/disc_track.jpg?v=2', cats: ['奥运项目', '田径类'], metrics: m(84, 76, 523000, 59000, 18000, 3600, 0) },
]

export function contentById(id: string) {
  return CONTENTS.find((c) => c.id === id)
}

/* ============ 课程 ============ */
export const COURSES: Course[] = [
  { id: 'k1', name: '摔跤入门：站姿与倒地保护', mentorId: 'm1', projectId: 'p1', format: '线下', audience: '零基础青少年及成人', outline: ['安全倒地与受身', '基础站姿与重心', '基础步伐与距离', '入门技术体验'], status: '报名开放', sessions: '6课时 · 每周六', region: '上海', metrics: m(90, 78, 52000, 3200, 2100, 210, 0), trend: t(1, 2, 1) },
  { id: 'k2', name: '柔道基础技术十二讲', mentorId: 'm2', projectId: 'p2', format: '线上', audience: '有一定基础的学员', outline: ['受身系统复习', '投技五讲', '寝技三讲', '实战复盘两讲', '礼仪与比赛规则'], status: '进行中', sessions: '12讲 · 已更新8讲', region: '线上', metrics: m(86, 74, 88000, 5100, 3600, 420, 0), trend: t(0, 1, 2) },
  { id: 'k3', name: '青少年田径爆发力训练营', mentorId: 'm3', projectId: 'p3', format: '线下', audience: '12-17岁青少年', outline: ['起动技术', '节奏训练', '力量基础', '测试与评估'], status: '招募中', sessions: '寒假集训 · 10天', region: '南京', metrics: m(84, 70, 36000, 2400, 1500, 180, 0), trend: t(2, 1, 1) },
  { id: 'k4', name: '游泳成人零基础班', mentorId: 'm4', projectId: 'p4', format: '线下', audience: '成人零基础', outline: ['熟悉水性', '漂浮与呼吸', '自由泳分解', '完整泳姿'], status: '报名开放', sessions: '8课时 · 小班制', region: '上海', metrics: m(82, 68, 41000, 2800, 1900, 220, 0), trend: t(1, 0, 1) },
  { id: 'k5', name: '击剑少年启蒙课', mentorId: 'm6', projectId: 'p7', format: '线下', audience: '8-14岁青少年', outline: ['实战姿势', '步伐练习', '直刺与防守', '条件实战'], status: '报名开放', sessions: '10课时 · 周末班', region: '北京', metrics: m(80, 60, 22000, 1400, 900, 110, 0), trend: t(0, 1, 0) },
  { id: 'k6', name: '篮球控球强化营', mentorId: 'm5', projectId: 'p5', format: '线下', audience: '有基础爱好者', outline: ['静态控球', '动态控球', '对抗运用', '比赛阅读'], status: '已满员', sessions: '8课时 · 周三晚', region: '成都', metrics: m(78, 72, 30000, 2100, 1200, 160, 0), trend: t(-1, 1, 1) },
  { id: 'k7', name: '摔跤教练员研修课（授权教练专属）', mentorId: 'm1', projectId: 'p1', format: '线上', audience: '获授权的教练（演示）', outline: ['教学体系讲解', '课程设计方法', '安全管理', '授权与规范'], status: '授权可见', sessions: '4讲 · 授权学员可见', region: '线上', metrics: m(92, 52, 6800, 420, 380, 60, 0), trend: t(0, 0, 1) },
]

export function courseById(id: string) {
  return COURSES.find((k) => k.id === id)
}

/* ============ 赛事 ============ */
export const EVENTS: Competition[] = [
  { id: 'e1', name: '全国青年摔跤锦标赛（华东赛区）', projectId: 'p1', date: '2026-12-05 ~ 12-08', location: '上海 · 体育馆（演示地点）', organizer: '演示组委会', intro: '面向18-20岁青年选手的区域选拔赛，设男子/女子多个公斤级（演示赛事，不构成真实报名）。', status: '报名中', quota: 200, enrolled: 128, region: '上海' },
  { id: 'e2', name: '市柔道公开赛 · 秋季', projectId: 'p2', date: '2026-11-28', location: '杭州 · 柔道馆（演示地点）', organizer: '演示组委会', intro: '面向市民与业余选手的公开赛，设多个体重级别与年龄组（演示）。', status: '即将截止', quota: 150, enrolled: 139, region: '杭州' },
  { id: 'e3', name: '城市田径挑战赛', projectId: 'p3', date: '2027-01-16', location: '南京 · 田径场（演示地点）', organizer: '演示组委会', intro: '短跑、跨栏、跳跃等项目的城市挑战赛（演示）。', status: '筹备中', quota: 300, enrolled: 0, region: '南京' },
  { id: 'e4', name: '少年游泳达标赛', projectId: 'p4', date: '2026-11-30', location: '上海 · 游泳馆（演示地点）', organizer: '演示组委会', intro: '青少年游泳等级达标测试赛（演示）。', status: '即将截止', quota: 120, enrolled: 110, region: '上海' },
  { id: 'e5', name: '羽毛球城市联赛 · 秋季', projectId: 'p6', date: '2026-11-01 ~ 11-30', location: '广州 · 多馆联动（演示地点）', organizer: '演示组委会', intro: '城市羽毛球团体联赛，正在进行中（演示）。', status: '进行中', quota: 64, enrolled: 64, region: '广州' },
  { id: 'e6', name: '攀岩交流赛 · 攀石专场', projectId: 'p8', date: '2026-10-20', location: '成都 · 攀岩馆（演示地点）', organizer: '演示组委会', intro: '攀石主题交流赛，已结束（演示）。', status: '已结束', quota: 80, enrolled: 80, region: '成都' },
]

export function eventById(id: string) {
  return EVENTS.find((e) => e.id === id)
}

/* ============ 机构（学校/俱乐部/场馆） ============ */
export const ORGS: Organization[] = [
  {
    id: 'o1', name: '锋跃摔跤俱乐部', type: '俱乐部', colorA: '#FF6B5E', colorB: '#FF9850',
    projectIds: ['p1'], memberIds: ['m1', 'a1'],
    intro: '专注青少年摔跤培养的俱乐部，体系导师徐峰主持教学（演示机构）。',
    activities: ['周末青少年体验课（演示）', '摔跤公开训练日（演示）'],
    contact: { phone: '021-****-****（演示占位）', address: '上海市××区××路××号（演示占位）' },
    region: '上海',
  },
  {
    id: 'o2', name: '城南青少年体育学校', type: '体育学校', colorA: '#19B9AC', colorB: '#0EA5E9',
    projectIds: ['p2', 'p3'], memberIds: ['m2', 'm3'],
    intro: '九年一贯制体教结合学校，开设柔道、田径等专项班（演示机构）。',
    activities: ['校园柔道开放日（演示）', '田径选材测试（演示）'],
    contact: { phone: '0571-****-****（演示占位）', address: '杭州市××区××路××号（演示占位）' },
    region: '杭州',
  },
  {
    id: 'o3', name: '西区全民健身中心 · 游泳馆', type: '场馆', colorA: '#2B7FFF', colorB: '#1565C0',
    projectIds: ['p4'], memberIds: ['m4'],
    intro: '社区综合场馆，50米标准池与训练池，承接培训与达标赛（演示场馆）。',
    activities: ['成人晨泳专场（演示）', '泳姿公开课（演示）'],
    contact: { phone: '021-****-****（演示占位）', address: '上海市××区××路××号（演示占位）' },
    region: '上海',
  },
  {
    id: 'o4', name: '星火羽毛球俱乐部', type: '俱乐部', colorA: '#22C55E', colorB: '#84CC16',
    projectIds: ['p6'], memberIds: ['a8'],
    intro: '社区羽毛球俱乐部，常年组织联赛与青少年培训（演示机构）。',
    activities: ['周末双打擂台（演示）', '青少年基础班（演示）'],
    contact: { phone: '020-****-****（演示占位）', address: '广州市××区××路××号（演示占位）' },
    region: '广州',
  },
]

export function orgById(id: string) {
  return ORGS.find((o) => o.id === id)
}

/* ============ 师徒关系与授权（与"身份"分离的数据关系） ============ */
export const MENTORSHIPS: Mentorship[] = [
  { id: 'ms1', mentorId: 'm1', menteeId: 'u0', role: 'student', since: '2026-09（演示）' },
  { id: 'ms2', mentorId: 'm1', menteeId: 'u0', role: 'coach', since: '2026-03（演示）' },
  { id: 'ms3', mentorId: 'u0', menteeId: 's1', role: 'student', since: '2026-08（演示）' },
  { id: 'ms4', mentorId: 'u0', menteeId: 's2', role: 'student', since: '2025-06（演示）' },
]

export const AUTHORIZATIONS: Authorization[] = [
  {
    id: 'az1', mentorshipId: 'ms1', mentorId: 'm1', granteeId: 'u0',
    scope: { project: '摔跤', content: '入门课程学习', region: '华东地区', term: '2026-01-01 ~ 2026-12-31' },
    allowSubGrant: false, status: '生效中',
  },
  {
    id: 'az2', mentorshipId: 'ms2', mentorId: 'm1', granteeId: 'u0',
    scope: { project: '摔跤', content: '青少年启蒙课程教学与授权', region: '上海市', term: '2026-03-01 ~ 2027-02-28' },
    allowSubGrant: true, status: '生效中',
  },
  {
    id: 'az3', mentorshipId: 'ms3', mentorId: 'u0', granteeId: 's1',
    scope: { project: '摔跤', content: '入门体验课教学', region: '上海市', term: '2026-08-01 ~ 2027-01-31' },
    allowSubGrant: false, status: '生效中', parentAuthorizationId: 'az2',
  },
  {
    id: 'az4', mentorshipId: 'ms4', mentorId: 'u0', granteeId: 's2',
    scope: { project: '摔跤', content: '入门体验课教学', region: '上海市', term: '2025-07-01 ~ 2026-06-30' },
    allowSubGrant: false, status: '已到期', parentAuthorizationId: 'az2',
  },
]

export function authById(id: string) {
  return AUTHORIZATIONS.find((a) => a.id === id)
}
export function mentorshipsOf(userId: string) {
  return MENTORSHIPS.filter((ms) => ms.mentorId === userId || ms.menteeId === userId)
}
export function authsFor(userId: string) {
  // 当前用户作为授权方或被授权方的授权记录
  return AUTHORIZATIONS.filter((a) => a.granteeId === userId || a.mentorId === userId)
}

/* ============ 榜单数据池（排名/得分/名次变化全部为演示） ============ */
type PoolItem = [string, number, boolean, number, number, number, number, number, number, Trend, boolean?]
// [id, prof, profVerified, influence, views, likes, favs, comments, follows, delta, appeal?]

export const RANK_POOL: RankEntity[] = [
  // 运动员（原型人物居前：张伟/李娜/王强为综合榜前三演示）
  { id: 'nw1', type: 'athlete', prof: 98.5, profVerified: true, influence: 98.5, views: 1285000, likes: 126000, favs: 38000, comments: 8200, follows: 52000, delta: t(3, 5, 12) },
  { id: 'nw4', type: 'athlete', prof: 97.2, profVerified: true, influence: 97.2, views: 648000, likes: 67000, favs: 21000, comments: 4100, follows: 38000, delta: t(1, 2, 8) },
  { id: 'nw5', type: 'athlete', prof: 96.05, profVerified: true, influence: 96.05, views: 523000, likes: 59000, favs: 18000, comments: 3600, follows: 32000, delta: t(1, 1, 5) },
  { id: 'nw2', type: 'athlete', prof: 95.8, profVerified: true, influence: 95.8, views: 460000, likes: 52000, favs: 16000, comments: 3100, follows: 29000, delta: t(0, 1, 1) },
  { id: 'nw3', type: 'athlete', prof: 95.6, profVerified: true, influence: 95.6, views: 420000, likes: 48000, favs: 15000, comments: 2900, follows: 27000, delta: t(1, 1, 0) },
  { id: 'a1', type: 'athlete', prof: 96, profVerified: true, influence: 92, views: 324000, likes: 42000, favs: 12600, comments: 2100, follows: 45800, delta: t(1, 0, 2) },
  { id: 'a2', type: 'athlete', prof: 91, profVerified: true, influence: 78, views: 58000, likes: 9200, favs: 3100, comments: 660, follows: 12300, delta: t(2, 1, 1) },
  { id: 'a3', type: 'athlete', prof: 88, profVerified: true, influence: 71, views: 96000, likes: 12300, favs: 4300, comments: 890, follows: 9800, delta: t(-1, 0, 1) },
  { id: 'a5', type: 'athlete', prof: 85, profVerified: true, influence: 80, views: 89000, likes: 10800, favs: 3800, comments: 720, follows: 11200, delta: t(0, 1, 0) },
  { id: 'a8', type: 'athlete', prof: 82, profVerified: true, influence: 68, views: 88000, likes: 11400, favs: 4200, comments: 690, follows: 8700, delta: t(1, 2, 2) },
  { id: 'a4', type: 'athlete', prof: 76, profVerified: false, influence: 52, views: 24000, likes: 3100, favs: 900, comments: 210, follows: 2600, delta: t(1, 1, 1) },
  { id: 'a7', type: 'athlete', prof: 79, profVerified: true, influence: 58, views: 41000, likes: 5600, favs: 2100, comments: 380, follows: 3400, delta: t(0, 1, 0) },
  { id: 'a6', type: 'athlete', prof: 81, profVerified: true, influence: 62, views: 35000, likes: 4900, favs: 1700, comments: 340, follows: 4100, delta: t(0, 0, 0), appeal: true },
  // 导师（原型人物居前：刘教练/陈教练/赵教练为人气榜前三演示）
  { id: 'nm1', type: 'mentor', prof: 94, profVerified: true, influence: 90, views: 987000, likes: 96000, favs: 28000, comments: 6800, follows: 26000, delta: t(1, 1, 2) },
  { id: 'nm2', type: 'mentor', prof: 90, profVerified: true, influence: 84, views: 853000, likes: 78000, favs: 22000, comments: 5200, follows: 21000, delta: t(0, 2, 1) },
  { id: 'nm3', type: 'mentor', prof: 87, profVerified: true, influence: 76, views: 726000, likes: 62000, favs: 17000, comments: 4300, follows: 17000, delta: t(1, 0, 1) },
  { id: 'nm4', type: 'mentor', prof: 85, profVerified: true, influence: 68, views: 320000, likes: 28000, favs: 9000, comments: 2400, follows: 9800, delta: t(0, 1, 0) },
  { id: 'nm5', type: 'mentor', prof: 86, profVerified: true, influence: 70, views: 350000, likes: 31000, favs: 10000, comments: 2600, follows: 11000, delta: t(1, 1, 1) },
  { id: 'nm6', type: 'mentor', prof: 84, profVerified: true, influence: 66, views: 300000, likes: 26000, favs: 8500, comments: 2200, follows: 9000, delta: t(0, 1, 0) },
  { id: 'm1', type: 'mentor', prof: 95, profVerified: true, influence: 86, views: 156000, likes: 18900, favs: 7600, comments: 1200, follows: 18600, delta: t(0, 1, 1) },
  { id: 'm2', type: 'mentor', prof: 90, profVerified: true, influence: 74, views: 218000, likes: 31000, favs: 9800, comments: 1600, follows: 14200, delta: t(1, 0, 1) },
  { id: 'm3', type: 'mentor', prof: 85, profVerified: true, influence: 66, views: 132000, likes: 17600, favs: 6200, comments: 940, follows: 9100, delta: t(-1, -1, 0) },
  { id: 'm4', type: 'mentor', prof: 83, profVerified: true, influence: 63, views: 108000, likes: 14200, favs: 5100, comments: 780, follows: 8200, delta: t(1, 1, 0) },
  { id: 'm5', type: 'mentor', prof: 79, profVerified: true, influence: 70, views: 166000, likes: 21400, favs: 7800, comments: 1300, follows: 7600, delta: t(0, 2, 1) },
  { id: 'm6', type: 'mentor', prof: 81, profVerified: true, influence: 48, views: 38000, likes: 5100, favs: 1900, comments: 320, follows: 4200, delta: t(1, 0, 0) },
  // 体育项目
  { id: 'p1', type: 'project', prof: 88, profVerified: true, influence: 92, views: 1200000, likes: 86000, favs: 32000, comments: 12400, follows: 42800, delta: t(2, 1, 3) },
  { id: 'p2', type: 'project', prof: 85, profVerified: true, influence: 84, views: 980000, likes: 64000, favs: 25000, comments: 9100, follows: 33500, delta: t(0, 2, 1) },
  { id: 'p3', type: 'project', prof: 82, profVerified: true, influence: 90, views: 1500000, likes: 102000, favs: 38000, comments: 15600, follows: 51000, delta: t(1, 0, 2) },
  { id: 'p5', type: 'project', prof: 78, profVerified: true, influence: 94, views: 1800000, likes: 130000, favs: 46000, comments: 21000, follows: 62000, delta: t(3, 2, 2) },
  { id: 'p4', type: 'project', prof: 80, profVerified: true, influence: 86, views: 1100000, likes: 73000, favs: 29000, comments: 10800, follows: 39000, delta: t(-1, 1, 1) },
  { id: 'p6', type: 'project', prof: 76, profVerified: true, influence: 88, views: 1350000, likes: 91000, favs: 34000, comments: 14200, follows: 47000, delta: t(1, 1, 0) },
  { id: 'p7', type: 'project', prof: 74, profVerified: true, influence: 70, views: 520000, likes: 28000, favs: 11000, comments: 4600, follows: 15200, delta: t(0, -1, 1) },
  { id: 'p8', type: 'project', prof: 72, profVerified: true, influence: 76, views: 640000, likes: 41000, favs: 16000, comments: 6200, follows: 21000, delta: t(2, 2, 1) },
  // 课程
  { id: 'k1', type: 'course', prof: 90, profVerified: true, influence: 78, views: 52000, likes: 3200, favs: 2100, comments: 210, follows: 0, delta: t(1, 2, 1) },
  { id: 'k2', type: 'course', prof: 86, profVerified: true, influence: 74, views: 88000, likes: 5100, favs: 3600, comments: 420, follows: 0, delta: t(0, 1, 2) },
  { id: 'k4', type: 'course', prof: 82, profVerified: true, influence: 68, views: 41000, likes: 2800, favs: 1900, comments: 220, follows: 0, delta: t(1, 0, 1) },
  { id: 'k3', type: 'course', prof: 84, profVerified: true, influence: 64, views: 36000, likes: 2400, favs: 1500, comments: 180, follows: 0, delta: t(2, 1, 1) },
  { id: 'k5', type: 'course', prof: 80, profVerified: true, influence: 56, views: 22000, likes: 1400, favs: 900, comments: 110, follows: 0, delta: t(0, 1, 0) },
  { id: 'k6', type: 'course', prof: 78, profVerified: true, influence: 72, views: 30000, likes: 2100, favs: 1200, comments: 160, follows: 0, delta: t(-1, 1, 1) },
  { id: 'k7', type: 'course', prof: 92, profVerified: true, influence: 40, views: 6800, likes: 420, favs: 380, comments: 60, follows: 0, delta: t(0, 0, 1) },
  // 赛事
  { id: 'e1', type: 'event', prof: 88, profVerified: true, influence: 72, views: 68000, likes: 5200, favs: 2600, comments: 480, follows: 0, delta: t(2, 1, 1) },
  { id: 'e2', type: 'event', prof: 76, profVerified: true, influence: 66, views: 44000, likes: 3800, favs: 1500, comments: 320, follows: 0, delta: t(1, 0, 0) },
  { id: 'e3', type: 'event', prof: 80, profVerified: true, influence: 58, views: 22000, likes: 1600, favs: 800, comments: 140, follows: 0, delta: t(0, 1, 0) },
  { id: 'e4', type: 'event', prof: 70, profVerified: true, influence: 52, views: 18000, likes: 1200, favs: 500, comments: 110, follows: 0, delta: t(1, 0, 1) },
  { id: 'e5', type: 'event', prof: 74, profVerified: true, influence: 76, views: 96000, likes: 8100, favs: 2400, comments: 620, follows: 0, delta: t(0, 2, 1) },
  { id: 'e6', type: 'event', prof: 72, profVerified: true, influence: 54, views: 32000, likes: 2600, favs: 900, comments: 180, follows: 0, delta: t(-1, -1, -1) },
  // 体育机构
  { id: 'o1', type: 'org', prof: 90, profVerified: true, influence: 74, views: 42000, likes: 3600, favs: 1400, comments: 260, follows: 5200, delta: t(1, 1, 2) },
  { id: 'o2', type: 'org', prof: 86, profVerified: true, influence: 70, views: 38000, likes: 3100, favs: 1200, comments: 220, follows: 4800, delta: t(0, 1, 0) },
  { id: 'o3', type: 'org', prof: 78, profVerified: true, influence: 62, views: 26000, likes: 1900, favs: 800, comments: 160, follows: 3100, delta: t(1, 0, 0) },
  { id: 'o4', type: 'org', prof: 74, profVerified: true, influence: 58, views: 21000, likes: 1500, favs: 600, comments: 130, follows: 2400, delta: t(0, 1, 1) },
  // 城市榜（综合指数为演示）
  { id: 'city-sh', type: 'city', prof: 94, profVerified: true, influence: 96, views: 0, likes: 0, favs: 0, comments: 0, follows: 0, delta: t(0, 1, 0) },
  { id: 'city-bj', type: 'city', prof: 92, profVerified: true, influence: 90, views: 0, likes: 0, favs: 0, comments: 0, follows: 0, delta: t(1, 0, 1) },
  { id: 'city-hz', type: 'city', prof: 86, profVerified: true, influence: 84, views: 0, likes: 0, favs: 0, comments: 0, follows: 0, delta: t(2, 1, 1) },
  { id: 'city-nj', type: 'city', prof: 84, profVerified: true, influence: 78, views: 0, likes: 0, favs: 0, comments: 0, follows: 0, delta: t(-1, 0, 0) },
  { id: 'city-cd', type: 'city', prof: 80, profVerified: true, influence: 76, views: 0, likes: 0, favs: 0, comments: 0, follows: 0, delta: t(1, 1, 1) },
  { id: 'city-gz', type: 'city', prof: 78, profVerified: true, influence: 72, views: 0, likes: 0, favs: 0, comments: 0, follows: 0, delta: t(0, -1, -1) },
]

export const CITY_INFO: Record<string, { name: string; note: string }> = {
  'city-sh': { name: '上海', note: '场馆设施·赛事人才综合指数（演示）' },
  'city-bj': { name: '北京', note: '场馆设施·赛事人才综合指数（演示）' },
  'city-hz': { name: '杭州', note: '场馆设施·赛事人才综合指数（演示）' },
  'city-nj': { name: '南京', note: '场馆设施·赛事人才综合指数（演示）' },
  'city-cd': { name: '成都', note: '场馆设施·赛事人才综合指数（演示）' },
  'city-gz': { name: '广州', note: '场馆设施·赛事人才综合指数（演示）' },
}

export const REGIONS = ['上海', '杭州', '南京', '北京', '成都', '广州']

/* ============ 消息（模拟通知，按高保真原型 5 分类 / 12 条） ============ */
export const MESSAGES: MsgItem[] = [
  { id: 'msg1', cat: 'system', kind: 'system', title: '系统通知', body: '平台将于今晚22:00进行系统维护，预计30分钟…', time: '今天 14:30', unread: true, badge: 3, target: '/messages?cat=system' },
  { id: 'msg2', cat: 'interact', kind: 'follow', title: '张伟', body: '我关注了你，希望能一起交流摔跤技术！', time: '今天 13:20', unread: true, badge: 1, avatar: 'img/top_av_1.jpg', verified: true, target: '/athlete/nw1' },
  { id: 'msg3', cat: 'interact', kind: 'like', title: '点赞消息', body: '李娜 赞了你的动态："训练真的很刻苦！"', time: '昨天 20:15', unread: false, target: '/athlete/nw4' },
  { id: 'msg4', cat: 'interact', kind: 'comment', title: '评论消息', body: '王强 评论了你的视频："技术动作很标准…"', time: '昨天 18:45', unread: true, badge: 2, target: '/athlete/nw5' },
  { id: 'msg5', cat: 'biz', kind: 'course', title: '课程通知', body: '您报名的《摔跤基础训练课程》将于明天开课', time: '昨天 16:30', unread: false, target: '/course/k1' },
  { id: 'msg6', cat: 'biz', kind: 'event', title: '赛事通知', body: '2025全国青少年摔跤锦标赛开始报名啦！', time: '昨天 10:20', unread: false, target: '/event/e1' },
  { id: 'msg7', cat: 'mentor', kind: 'mentorship', title: '师徒消息', body: '您的导师李教练向您发送了新的训练计划', time: '周一 19:30', unread: false, target: '/mentorship' },
  { id: 'msg8', cat: 'mentor', kind: 'auth', title: '授权通知', body: '您已获得"摔跤项目"二级教练授权', time: '周一 14:12', unread: false, target: '/authorization/az2' },
  { id: 'msg9', cat: 'interact', kind: 'dm', title: '私信消息', body: '林昊：下次训练课一起练摔跤吧！', time: '周日 21:05', unread: false, target: '/athlete/a1' },
  { id: 'msg10', cat: 'biz', kind: 'event', title: '报名提醒', body: '市柔道公开赛·秋季报名将于11-27截止', time: '周日 18:40', unread: false, target: '/event/e2' },
  { id: 'msg11', cat: 'mentor', kind: 'mentorship', title: '导师邀请', body: '导师徐峰邀请您进行阶段训练总结', time: '周六 15:22', unread: false, target: '/mentorship' },
  { id: 'msg12', cat: 'system', kind: 'system', title: '平台公告', body: '专体全国体育赛事报名通道正式开启', time: '周五 09:00', unread: false, target: '/list/events' },
]

/* ============ TOP 页荣誉数据（本期焦点 / 演示快照） ============ */
export const PODIUM: PodiumItem[] = [
  { id: 'nw1', rank: 1, vals: { overall: 99.8, pro: 99.2, popularity: 96.5 } },
  { id: 'nw2', rank: 2, vals: { overall: 98.5, pro: 98.8, popularity: 95.2 } },
  { id: 'nw3', rank: 3, vals: { overall: 97.9, pro: 97.5, popularity: 94.8 } },
]

// TOP 页热门导师榜（人气值 = 演示互动热度）
export const HOT_MENTORS = [
  { id: 'nm1', heat: '98.7w' },
  { id: 'nm2', heat: '85.3w' },
  { id: 'nm3', heat: '72.6w' },
]

// 发现页推荐导师
export const DISCOVER_MENTORS = ['nm4', 'nm5', 'nm6']

// 发现页内容分类筛选
export const DISCOVER_CATS = ['奥运项目', '格斗对抗', '田径类', '水上运动']
