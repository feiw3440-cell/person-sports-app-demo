// 演示种子数据（全部为「演示数据」，仅本地 Demo 使用；不得用于生产）
// 数据语义映射自 APP 端 src/data/db.ts（蓝白体育科技风 Demo），实体升级为权威库结构。
import { db, kvSet } from '../../src/db'
import { hashPassword } from '../../src/auth'
import { seedRankings } from './seed-rankings'
import { newId, nowISO } from '../../src/util'

const T = (offsetDays = 0): string => new Date(Date.now() + offsetDays * 86400000).toISOString()

function upsertAccount(login: string, display: string, password: string) {
  const existing = db.prepare('SELECT id FROM accounts WHERE login_name = ?').get(login) as { id: string } | undefined
  if (existing) return existing.id
  const id = newId('acc_')
  db.prepare(
    'INSERT INTO accounts(id, login_name, password_hash, display_name, avatar_url, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
  ).run(id, login, hashPassword(password), display, null, 'active', T(-300), T(-300))
  return id
}

function addIdentity(accountId: string, type: string, label: string, status = 'active'): string {
  const dup = db.prepare('SELECT id FROM identities WHERE account_id = ? AND identity_type = ?').get(accountId, type) as { id: string } | undefined
  if (dup) return dup.id
  const id = newId('idn_')
  db.prepare('INSERT INTO identities(id, account_id, identity_type, label, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, 1)').run(
    id, accountId, type, label, status, T(-290), T(-290),
  )
  return id
}

function addMembership(accountId: string, orgId: string, role: string, position: string, status = 'accepted'): string {
  const dup = db.prepare('SELECT id FROM memberships WHERE account_id = ? AND org_id = ?').get(accountId, orgId) as { id: string } | undefined
  if (dup) return dup.id
  const id = newId('m_')
  db.prepare('INSERT INTO memberships(id, account_id, org_id, role, position, status, invited_by, decided_at, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)').run(
    id, accountId, orgId, role, position, status, null, status === 'accepted' ? T(-200) : null, T(-200), T(-200),
  )
  return id
}

function addProfile(accountId: string, kind: string, title: string, region: string, bio: string, verify = 'unverified', mentorInfo?: unknown): string {
  const id = newId('pf_')
  db.prepare(
    'INSERT INTO person_profiles(id, account_id, kind, title, bio, region, achievements, career, mentor_info, verify_status, visibility, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
  ).run(
    id, accountId, kind, title, bio, region,
    JSON.stringify(kind === 'athlete' ? [{ name: '（演示）城市锦标赛前八', date: '2025-05', unverified: true }] : []),
    JSON.stringify(kind === 'athlete' ? [{ year: '2023', text: '（演示）入队训练' }] : []),
    mentorInfo ? JSON.stringify(mentorInfo) : null,
    verify,
    JSON.stringify({ contact: 'org', achievements: 'public' }),
    T(-280), T(-280),
  )
  return id
}

/** RBAC 权限矩阵（对应 docs/platform/03-权限矩阵.md） */
const ROLE_PERMISSIONS: [string, string, string, string][] = [
  // 基础登录角色（含未持任何身份的账号）
  ...['user', 'regular', 'student', 'athlete', 'org_member'].flatMap((r): [string, string, string, string][] => [
    [r, 'projects', 'read', 'all'],
    [r, 'courses', 'read', 'all'],
    [r, 'competitions', 'read', 'all'],
    [r, 'contents', 'read', 'all'],
    [r, 'rankings', 'read', 'all'],
    [r, 'people', 'read', 'self'],
    [r, 'enrollments', 'read', 'self'],
    [r, 'registrations', 'read', 'self'],
    [r, 'enrollments', 'create', 'self'],
    [r, 'registrations', 'create', 'self'],
    [r, 'training', 'read', 'self'],
    [r, 'training', 'write', 'self'],
    [r, 'mentorships', 'read', 'self'],
    [r, 'authorizations', 'read', 'self'],
    [r, 'analytics', 'read', 'self'],
  ]),
  // 教练/导师
  ...['coach', 'mentor'].flatMap((r): [string, string, string, string][] => [
    [r, 'courses', 'write', 'self'],
    [r, 'courses', 'read', 'self'],
    [r, 'enrollments', 'read', 'granted_scope'],
    [r, 'enrollments', 'review', 'granted_scope'],
    [r, 'attendance', 'read', 'granted_scope'],
    [r, 'attendance', 'write', 'granted_scope'],
    [r, 'training', 'read', 'granted_scope'],
    [r, 'training', 'write', 'granted_scope'],
    [r, 'people', 'read', 'granted_scope'],
    [r, 'mentorships', 'write', 'granted_scope'],
    [r, 'mentorships', 'read', 'self'],
    [r, 'authorizations', 'read', 'self'],
    [r, 'authorizations', 'write', 'self'],
    [r, 'contents', 'write', 'self'],
  ]),
  // 机构管理员
  ...['org_admin'].flatMap((r): [string, string, string, string][] => [
    [r, 'members', 'read', 'own_org'],
    [r, 'members', 'invite', 'own_org'],
    [r, 'members', 'manage', 'own_org'],
    [r, 'people', 'read', 'own_org'],
    [r, 'people', 'write', 'own_org'],
    [r, 'people', 'export', 'own_org'],
    [r, 'courses', 'read', 'own_org'],
    [r, 'courses', 'write', 'own_org'],
    [r, 'enrollments', 'read', 'own_org'],
    [r, 'enrollments', 'review', 'own_org'],
    [r, 'attendance', 'read', 'own_org'],
    [r, 'attendance', 'write', 'own_org'],
    [r, 'competitions', 'read', 'own_org'],
    [r, 'competitions', 'write', 'own_org'],
    [r, 'registrations', 'read', 'own_org'],
    [r, 'registrations', 'review', 'own_org'],
    [r, 'results', 'read', 'own_org'],
    [r, 'authorizations', 'read', 'own_org'],
    [r, 'authorizations', 'write', 'own_org'],
    [r, 'mentorships', 'read', 'own_org'],
    [r, 'analytics', 'read', 'own_org'],
    [r, 'analytics', 'export', 'own_org'],
    [r, 'contents', 'read', 'own_org'],
  ]),
  // 平台审核员
  ['reviewer', 'credentials', 'review', 'platform'],
  ['reviewer', 'contents', 'review', 'platform'],
  ['reviewer', 'contents', 'read', 'all'],
  ['reviewer', 'authorizations', 'read', 'all'],
  ['reviewer', 'authorizations', 'write', 'platform'],
  ['reviewer', 'people', 'read', 'platform'],
  // 内容编辑
  ['content_editor', 'contents', 'write', 'self'],
  ['content_editor', 'contents', 'read', 'self'],
  // 赛事组织者
  ['event_organizer', 'competitions', 'write', 'own_org'],
  ['event_organizer', 'competitions', 'read', 'own_org'],
  ['event_organizer', 'registrations', 'read', 'own_org'],
  ['event_organizer', 'registrations', 'review', 'own_org'],
  // 平台运营
  ...['platform_ops', 'platform_admin'].flatMap((r): [string, string, string, string][] => [
    [r, 'projects', 'write', 'all'],
    [r, 'projects', 'read', 'all'],
    [r, 'people', 'read', 'platform'],
    [r, 'people', 'export', 'all'],
    [r, 'credentials', 'review', 'platform'],
    [r, 'contents', 'read', 'all'],
    [r, 'contents', 'review', 'platform'],
    [r, 'authorizations', 'read', 'all'],
    [r, 'authorizations', 'write', 'platform'],
    [r, 'rankings', 'write', 'all'],
    [r, 'analytics', 'read', 'all'],
    [r, 'analytics', 'export', 'all'],
    [r, 'competitions', 'read', 'all'],
    [r, 'courses', 'read', 'all'],
    [r, 'members', 'read', 'all'],
  ]),
  ['platform_admin', 'admin', 'read', 'all'],
  ['platform_admin', 'admin', 'manage', 'all'],
  ['platform_admin', 'audit_logs', 'read', 'all'],
]

export function seed(): void {
  const existing = (db.prepare('SELECT COUNT(*) AS c FROM accounts').get() as { c: number }).c
  if (existing > 0) {
    console.log('[seed] 已存在账号，跳过种子（如需重置请运行 npm run db:reset）')
    return
  }

  /* ---------- 权限矩阵 ---------- */
  const insPerm = db.prepare('INSERT OR IGNORE INTO role_permissions(role, resource, action, data_scope) VALUES (?, ?, ?, ?)')
  for (const [role, resource, action, scope] of ROLE_PERMISSIONS) insPerm.run(role, resource, action, scope)

  /* ---------- 账号（密码统一 demo1234，仅本地演示） ---------- */
  seedRankings(db)
  const accAdmin = upsertAccount('admin@local', '平台管理员·谭青', 'demo1234')
  const accOrgAdmin = upsertAccount('orgadmin@local', '锋跃管理员·铁娟', 'demo1234')
  const accMentor = upsertAccount('mentor@local', '导师·徐峰', 'demo1234')
  const accCoach = upsertAccount('coach@local', '授权教练·何小授', 'demo1234')
  const accDemo = upsertAccount('demo@local', '演示学员·阿体', 'demo1234')
  const accOrgAdmin2 = upsertAccount('orgadmin2@local', '东方管理员·娄山', 'demo1234')
  const accAth1 = upsertAccount('athlete1@local', '林昊', 'demo1234')
  const accAth2 = upsertAccount('athlete2@local', '陈一诺', 'demo1234')
  const accAth3 = upsertAccount('athlete3@local', '周子昂', 'demo1234')

  /* ---------- 身份 ---------- */
  const idnAdminOps = addIdentity(accAdmin, 'platform_ops', '平台运营')
  addIdentity(accAdmin, 'platform_admin', '平台管理员')
  addIdentity(accOrgAdmin, 'regular', '普通用户')
  addIdentity(accOrgAdmin2, 'regular', '普通用户')
  const idnMentor = addIdentity(accMentor, 'mentor', '认证导师（等级占位名·规则待确认）')
  const idnCoach = addIdentity(accCoach, 'coach', '教练')
  addIdentity(accDemo, 'student', '学员')
  addIdentity(accDemo, 'athlete', '运动员')
  addIdentity(accAth1, 'athlete', '运动员')
  addIdentity(accAth2, 'athlete', '运动员')
  addIdentity(accAth3, 'athlete', '运动员')

  /* ---------- 资质（含待审核 → PC 审核演示目标） ---------- */
  const credIns = db.prepare(
    'INSERT INTO credentials(id, identity_id, kind, source, evidence, status, valid_until, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
  )
  credIns.run(newId('cr_'), idnMentor, '认证导师（占位名）', '平台资质审核（演示语义）', null, 'approved', T(400), T(-250), T(-250))
  credIns.run(newId('cr_'), idnCoach, '教练资质（演示）', '培训机构证书（演示）', null, 'submitted', T(300), T(-3), T(-3))
  credIns.run(newId('cr_'), (db.prepare('SELECT id FROM identities WHERE account_id = ? AND identity_type = ?').get(accDemo, 'athlete') as { id: string }).id, '运动员注册（演示）', '省队注册记录（演示）', null, 'submitted', T(300), T(-2), T(-2))

  /* ---------- 组织 ---------- */
  const orgIns = db.prepare('INSERT INTO organizations(id, name, type, parent_id, region, intro, contact, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)')
  const org1 = newId('o_')
  orgIns.run(org1, '锋跃摔跤俱乐部', 'club', null, '上海', '（演示机构）专注摔跤青少年培养', JSON.stringify({ phone: '021-0000-0000（演示占位）', address: '上海市（演示占位）' }), 'active', T(-260), T(-260))
  const org2 = newId('o_')
  orgIns.run(org2, '东方柔道俱乐部', 'club', null, '杭州', '（演示机构）柔道训练与赛事组织', JSON.stringify({ phone: '0571-0000-0000（演示占位）', address: '杭州市（演示占位）' }), 'active', T(-260), T(-260))

  addMembership(accOrgAdmin, org1, 'org_admin', '俱乐部管理员')
  addMembership(accMentor, org1, 'coach', '主讲导师')
  addMembership(accCoach, org1, 'member', '授权教练')
  addMembership(accDemo, org1, 'athlete', '注册学员')
  addMembership(accAth1, org1, 'athlete', '运动员')
  addMembership(accAth2, org1, 'athlete', '运动员')
  addMembership(accOrgAdmin2, org2, 'org_admin', '俱乐部管理员')
  addMembership(accAth3, org2, 'athlete', '运动员')

  /* ---------- 体育项目主数据 ---------- */
  const projIns = db.prepare('INSERT INTO sports_projects(id, name, name_en, slug, intro, source, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)')
  const P = { wrestling: newId('p_'), judo: newId('p_'), track: newId('p_'), swim: newId('p_'), fence: newId('p_'), climb: newId('p_') }
  projIns.run(P.wrestling, '摔跤', 'Wrestling', 'wrestling', '（演示）格斗对抗类项目，含自由式与古典式', '国际摔联通用分类（演示口径）', 'active', T(-270), T(-270))
  projIns.run(P.judo, '柔道', 'Judo', 'judo', '（演示）近身格斗对抗项目，强调摔倒与压制技术', '国际柔联分类（演示口径）', 'active', T(-270), T(-270))
  projIns.run(P.track, '田径', 'Athletics', 'track', '（演示）走跑跳投等田赛径赛项目总称', '世界田联分类（演示口径）', 'active', T(-270), T(-270))
  projIns.run(P.swim, '游泳', 'Swimming', 'swim', '（演示）水上运动核心项目', '世界泳联分类（演示口径）', 'active', T(-270), T(-270))
  projIns.run(P.fence, '击剑', 'Fencing', 'fencing', '（演示）持械对抗类项目', '国际剑联分类（演示口径）', 'active', T(-270), T(-270))
  projIns.run(P.climb, '攀岩', 'Sport Climbing', 'sport-climbing', '（演示）室内外攀爬项目', '国际攀联分类（演示口径）', 'active', T(-270), T(-270))

  const catIns = db.prepare('INSERT INTO project_categories(id, name) VALUES (?, ?)')
  const tagIns = db.prepare('INSERT INTO project_tags(id, name) VALUES (?, ?)')
  const cats = { olympic: newId('pc_'), combat: newId('pc_'), water: newId('pc_'), track: newId('pc_') }
  catIns.run(cats.olympic, '奥运项目'); catIns.run(cats.combat, '格斗对抗'); catIns.run(cats.water, '水上运动'); catIns.run(cats.track, '田径类')
  const tags = { grappling: newId('pt_'), endurance: newId('pt_'), indoor: newId('pt_'), youth: newId('pt_') }
  tagIns.run(tags.grappling, '对抗性'); tagIns.run(tags.endurance, '耐力'); tagIns.run(tags.indoor, '室内'); tagIns.run(tags.youth, '青少年友好')
  const catLink = db.prepare('INSERT OR IGNORE INTO project_category_links(project_id, category_id) VALUES (?, ?)')
  const tagLink = db.prepare('INSERT OR IGNORE INTO project_tag_links(project_id, tag_id) VALUES (?, ?)')
  for (const pid of [P.wrestling, P.judo, P.fence]) { catLink.run(pid, cats.combat); catLink.run(pid, cats.olympic); tagLink.run(pid, tags.grappling) }
  catLink.run(P.track, cats.track); catLink.run(P.track, cats.olympic); tagLink.run(P.track, tags.endurance)
  catLink.run(P.swim, cats.water); catLink.run(P.swim, cats.olympic); tagLink.run(P.swim, tags.endurance)
  catLink.run(P.climb, cats.olympic); tagLink.run(P.climb, tags.indoor); tagLink.run(P.climb, tags.youth)

  const branchIns = db.prepare('INSERT INTO project_branches(id, project_id, name, created_at) VALUES (?, ?, ?, ?)')
  const unitIns = db.prepare('INSERT INTO competition_units(id, branch_id, name, gender, group_name, rule_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const bFree = newId('pb_'); const bGreco = newId('pb_')
  branchIns.run(bFree, P.wrestling, '自由式摔跤', T(-270)); branchIns.run(bGreco, P.wrestling, '古典式摔跤', T(-270))
  unitIns.run(newId('cu_'), bFree, '男子自由式 68kg', '男', '成年组', '规则 v2024（演示）', T(-270))
  unitIns.run(newId('cu_'), bFree, '女子自由式 52kg', '女', '青年组', '规则 v2024（演示）', T(-270))
  unitIns.run(newId('cu_'), bGreco, '男子古典式 77kg', '男', '成年组', '规则 v2024（演示）', T(-270))
  const bJudo = newId('pb_')
  branchIns.run(bJudo, P.judo, '竞技柔道', T(-270))
  unitIns.run(newId('cu_'), bJudo, '男子 -73kg', '男', '成年组', '规则 v2024（演示）', T(-270))

  /* ---------- 项目关联（多对多演示） ---------- */
  const relIns = db.prepare('INSERT OR IGNORE INTO project_relations(id, project_id, entity_type, entity_id) VALUES (?, ?, ?, ?)')

  /* ---------- 人员档案 ---------- */
  const pfMentor = addProfile(accMentor, 'mentor', '摔跤导师', '上海', '专注摔跤启蒙与青少年梯队培养（演示）', 'verified', {
    level: '认证导师（占位名称·规则待确认）', since: '2019', system: '三阶启蒙法（演示）', philosophy: '先兴趣后技术（演示）', studentCount: 12,
  })
  const pfCoach = addProfile(accCoach, 'coach', '授权教练', '上海', '获导师摔跤启蒙教学授权（演示）', 'unverified')
  const pfDemo = addProfile(accDemo, 'athlete', '业余摔跤运动员', '上海', '演示账号：学员/运动员双身份', 'unverified')
  const pfA1 = addProfile(accAth1, 'athlete', '摔跤运动员', '上海', '专注自由式摔跤（演示）', 'verified')
  const pfA2 = addProfile(accAth2, 'athlete', '柔道运动员', '上海', '柔道青年组（演示）', 'verified')
  const pfA3 = addProfile(accAth3, 'athlete', '田径运动员·110米栏', '杭州', '田径新秀（演示）', 'unverified')
  const pplLink = db.prepare('INSERT OR IGNORE INTO profile_project_links(profile_id, project_id, is_primary) VALUES (?, ?, ?)')
  pplLink.run(pfMentor, P.wrestling, 1); pplLink.run(pfCoach, P.wrestling, 1); pplLink.run(pfDemo, P.wrestling, 1)
  pplLink.run(pfA1, P.wrestling, 1); pplLink.run(pfA2, P.judo, 1); pplLink.run(pfA3, P.track, 1)
  relIns.run(newId('pr_'), P.wrestling, 'profile', pfMentor); relIns.run(newId('pr_'), P.wrestling, 'profile', pfA1)
  relIns.run(newId('pr_'), P.judo, 'profile', pfA2)

  /* ---------- 师徒与授权（链路：徐峰 → 何小授 → 阿体） ---------- */
  const msIns = db.prepare('INSERT INTO mentorships(id, mentor_account_id, mentee_account_id, kind, status, since, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)')
  const ms1 = newId('ms_'); const ms2 = newId('ms_')
  msIns.run(ms1, accMentor, accDemo, 'student', 'active', T(-150), T(-150), T(-150))
  msIns.run(ms2, accMentor, accCoach, 'coach', 'active', T(-180), T(-180), T(-180))
  const azIns = db.prepare(
    'INSERT INTO authorizations(id, mentorship_id, grantor_account_id, grantee_account_id, scope_project_id, scope_content, scope_region, term_start, term_end, allow_sub_grant, parent_authorization_id, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
  )
  const az1 = newId('az_')
  azIns.run(az1, ms2, accMentor, accCoach, P.wrestling, '启蒙教学内容', '华东', '2026-01-01', '2026-12-31', 1, null, 'active', T(-170), T(-170))
  const az2 = newId('az_')
  // 再授权（ submitted → PC 审核演示目标；链路 az1 → az2）
  azIns.run(az2, ms1, accCoach, accDemo, P.wrestling, '入门体验课', '上海', '2026-03-01', '2026-06-30', 0, az1, 'submitted', T(-2), T(-2))
  relIns.run(newId('pr_'), P.wrestling, 'org', org1)

  /* ---------- 课程与报名 ---------- */
  const courseIns = db.prepare('INSERT INTO courses(id, name, mentor_account_id, org_id, format, audience, outline, sessions, region, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)')
  const c1 = newId('c_'); const c2 = newId('c_'); const c3 = newId('c_'); const c4 = newId('c_')
  courseIns.run(c1, '摔跤启蒙训练营', accMentor, org1, 'offline', '8-14 岁青少年（演示）', JSON.stringify(['（演示）摔跤礼仪与安全', '（演示）基础站架', '（演示）倒地自护']), '每周六 09:00（演示）', '上海', 'published', T(-120), T(-30))
  courseIns.run(c2, '柔道基础技术课', accMentor, org1, 'online', '零基础学员（演示）', JSON.stringify(['（演示）受身', '（演示）基础投入']), '录播+每周答疑（演示）', '线上', 'published', T(-100), T(-25))
  courseIns.run(c3, '摔跤教练研修课（授权可见）', accMentor, org1, 'offline', '授权教练（演示）', JSON.stringify(['（演示）教学体系拆解']), '待定（演示）', '上海', 'pending_review', T(-5), T(-5))
  courseIns.run(c4, '攀岩体能入门', accMentor, org1, 'offline', '体能爱好者（演示）', JSON.stringify(['（演示）指力基础']), '待定（演示）', '上海', 'draft', T(-4), T(-4))
  const cpl = db.prepare('INSERT OR IGNORE INTO course_project_links(course_id, project_id) VALUES (?, ?)')
  cpl.run(c1, P.wrestling); cpl.run(c2, P.judo); cpl.run(c3, P.wrestling); cpl.run(c4, P.climb)
  relIns.run(newId('pr_'), P.wrestling, 'course', c1); relIns.run(newId('pr_'), P.judo, 'course', c2)
  const clsIns = db.prepare('INSERT INTO classes(id, course_id, name, schedule, capacity, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)')
  const cls1 = newId('cls_')
  clsIns.run(cls1, c1, '周六启蒙班', '每周六 09:00-10:30（演示）', 12, 'open', T(-118), T(-118))
  const enIns = db.prepare('INSERT INTO enrollments(id, course_id, class_id, account_id, status, decided_by, decided_at, reason, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)')
  enIns.run(newId('en_'), c1, cls1, accAth1, 'approved', accMentor, T(-20), '符合年龄段（演示）', T(-22), T(-20))
  enIns.run(newId('en_'), c2, null, accAth2, 'approved', accMentor, T(-18), null, T(-19), T(-18))
  enIns.run(newId('en_'), c1, cls1, accDemo, 'pending', null, null, null, T(-1), T(-1)) // PC 待审核目标
  enIns.run(newId('en_'), c1, cls1, accAth2, 'pending', null, null, null, T(-1), T(-1))

  /* ---------- 赛事与报名 ---------- */
  const compIns = db.prepare('INSERT INTO competitions(id, name, organizer_org_id, date_start, date_end, location, intro, quota, status, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)')
  const cmp1 = newId('cmp_'); const cmp2 = newId('cmp_'); const cmp3 = newId('cmp_'); const cmp4 = newId('cmp_')
  compIns.run(cmp1, '青少年摔跤锦标赛（春季）', org1, T(30), T(31), '上海（演示场馆）', '（演示赛事）自由式摔跤青少年组', 32, 'published', T(-60), T(-10))
  compIns.run(cmp2, '城市柔道公开赛', org2, T(45), T(46), '杭州（演示场馆）', '（演示赛事）竞技柔道分龄组', 64, 'published', T(-55), T(-9))
  compIns.run(cmp3, '田径精英邀请赛', org2, T(-5), T(-4), '杭州（演示场馆）', '（演示赛事）进行中，成绩录入演示', 24, 'in_progress', T(-70), T(-5))
  compIns.run(cmp4, '攀岩趣味挑战赛', org1, T(60), T(60), '上海（演示场馆）', '（演示赛事）草稿状态', 16, 'draft', T(-3), T(-3))
  const cmpl = db.prepare('INSERT OR IGNORE INTO competition_project_links(competition_id, project_id) VALUES (?, ?)')
  cmpl.run(cmp1, P.wrestling); cmpl.run(cmp2, P.judo); cmpl.run(cmp3, P.track); cmpl.run(cmp4, P.climb)
  relIns.run(newId('pr_'), P.wrestling, 'competition', cmp1)
  const schIns = db.prepare('INSERT INTO competition_schedules(id, competition_id, unit_name, phase, start_at, venue, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
  schIns.run(newId('sch_'), cmp1, '男子自由式 68kg', '预赛', T(30), 'A 垫（演示）', T(-10))
  schIns.run(newId('sch_'), cmp1, '女子自由式 52kg', '预赛', T(30), 'B 垫（演示）', T(-10))
  const rgIns = db.prepare('INSERT INTO registrations(id, competition_id, account_id, status, decided_by, decided_at, reason, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)')
  rgIns.run(newId('rg_'), cmp1, accAth1, 'approved', accOrgAdmin, T(-8), '资格符合（演示）', T(-9), T(-8))
  rgIns.run(newId('rg_'), cmp1, accDemo, 'pending', null, null, null, T(-1), T(-1)) // PC 待审核目标
  rgIns.run(newId('rg_'), cmp2, accAth3, 'approved', accOrgAdmin2, T(-7), null, T(-8), T(-7))

  /* ---------- 成绩（修订留痕演示） ---------- */
  const resIns = db.prepare('INSERT INTO results(id, competition_id, account_id, unit_name, rank, score, source, status, confirmed_by, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)')
  resIns.run(newId('res_'), cmp3, accAth3, '男子110米栏', 2, '14.35', '现场计时系统（演示）', 'provisional', null, T(-4), T(-4))
  resIns.run(newId('res_'), cmp3, accAth2, '女子100米', 1, '12.88', '现场计时系统（演示）', 'confirmed', accOrgAdmin2, T(-4), T(-4))

  /* ---------- 内容 ---------- */
  const ctIns = db.prepare('INSERT INTO contents(id, type, title, summary, author_account_id, status, published_at, views, likes, favs, comments, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)')
  const ct1 = newId('ct_'); const ct2 = newId('ct_'); const ct3 = newId('ct_'); const ct4 = newId('ct_'); const ct5 = newId('ct_')
  ctIns.run(ct1, 'video', '自由式摔跤入门三步（演示内容）', '站架/握把/倒地自护', accMentor, 'published', T(-80), 15200, 982, 211, 64, T(-80), T(-30))
  ctIns.run(ct2, 'article', '摔跤启蒙路线图（演示内容）', '从兴趣到系统的训练路径', accMentor, 'published', T(-70), 8400, 521, 130, 32, T(-70), T(-28))
  ctIns.run(ct3, 'video', '柔道受身教学（演示内容）', '安全倒地第一课', accCoach, 'published', T(-40), 6800, 342, 88, 21, T(-40), T(-20))
  ctIns.run(ct4, 'article', '青少年摔跤装备清单（演示内容）', '训练起步装备参考', accAth1, 'published', T(-20), 3200, 190, 45, 12, T(-20), T(-12))
  ctIns.run(ct5, 'video', '68kg 战术解析（演示内容·待审核）', '赛事技术复盘', accAth1, 'pending_review', null, 0, 0, 0, 0, T(-2), T(-2))
  const ctp = db.prepare('INSERT OR IGNORE INTO content_project_links(content_id, project_id) VALUES (?, ?)')
  ctp.run(ct1, P.wrestling); ctp.run(ct2, P.wrestling); ctp.run(ct3, P.judo); ctp.run(ct4, P.wrestling); ctp.run(ct5, P.wrestling)
  relIns.run(newId('pr_'), P.wrestling, 'content', ct1); relIns.run(newId('pr_'), P.judo, 'content', ct3)

  /* ---------- TOP 榜单（口径与快照，全部演示） ---------- */
  const rdIns = db.prepare('INSERT INTO ranking_definitions(id, category, mode, formula, period, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const periods: [string, string][] = [['week', '本周'], ['month', '本月'], ['total', '总榜']]
  for (const [period] of periods) {
    rdIns.run(newId('rd_'), 'athlete', 'overall', JSON.stringify({ note: '综合榜 = 专业表现 × 60% + 平台影响力 × 40%（示意权重，正式规则待确认）', weights: { prof: 0.6, influence: 0.4 } }), period, 'active', T(-1))
    rdIns.run(newId('rd_'), 'athlete', 'pro', JSON.stringify({ note: '专业榜依据经核验的成绩、资质与专业评价（演示）', fields: ['verified_results', 'credentials'] }), period, 'active', T(-1))
    rdIns.run(newId('rd_'), 'athlete', 'popularity', JSON.stringify({ note: '人气榜由关注/观看/收藏/评论构成，非仅按点赞（演示）', fields: ['follows', 'views', 'favs', 'comments'] }), period, 'active', T(-1))
  }
  rdIns.run(newId('rd_'), 'mentor', 'overall', JSON.stringify({ note: '导师综合榜（演示口径）' }), 'total', 'active', T(-1))
  const snapIns = db.prepare('INSERT INTO ranking_snapshots(id, definition_id, period_key, rows, computed_at) VALUES (?, ?, ?, ?, ?)')
  const nameById = (id: string) => db.prepare('SELECT display_name FROM accounts WHERE id = ?').get(id) as { display_name: string }
  const athleteRows = [
    { entity: 'profile', entity_id: pfA1, name: nameById(accAth1).display_name, score: 9850, delta: 12, note: '专业 98.5 · 影响力 98.5 · 示意权重 6:4' },
    { entity: 'profile', entity_id: pfA2, name: nameById(accAth2).display_name, score: 9605, delta: 8, note: '专业 96.5 · 影响力 95.5 · 示意权重 6:4' },
    { entity: 'profile', entity_id: pfDemo, name: nameById(accDemo).display_name, score: 7200, delta: -3, note: '专业 72 · 影响力 72 · 示意权重 6:4' },
  ]
  const rdAthleteOverallTotal = db.prepare("SELECT id FROM ranking_definitions WHERE category='athlete' AND mode='overall' AND period='total'").get() as { id: string }
  snapIns.run(newId('rs_'), rdAthleteOverallTotal.id, '2026-W46', JSON.stringify(athleteRows), T(-1))
  const rdAthleteProTotal = db.prepare("SELECT id FROM ranking_definitions WHERE category='athlete' AND mode='pro' AND period='total'").get() as { id: string }
  snapIns.run(newId('rs_'), rdAthleteProTotal.id, '2026-W46', JSON.stringify(athleteRows.map((r) => ({ ...r, note: '专业分（含核验成绩/资质）' }))), T(-1))
  const rdAthletePopTotal = db.prepare("SELECT id FROM ranking_definitions WHERE category='athlete' AND mode='popularity' AND period='total'").get() as { id: string }
  snapIns.run(newId('rs_'), rdAthletePopTotal.id, '2026-W46', JSON.stringify([...athleteRows].reverse().map((r) => ({ ...r, note: '关注/观看/收藏/评论构成（演示）' }))), T(-1))

  /* ---------- 通知（演示） ---------- */
  const ntIns = db.prepare('INSERT INTO notifications(id, account_id, category, kind, title, body, biz_ref_type, biz_ref_id, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  ntIns.run(newId('n_'), accOrgAdmin, 'biz', 'course', '课程报名待审核', '「摔跤启蒙训练营」收到 2 条新报名（演示通知）', 'course', c1, null, T(-1))
  ntIns.run(newId('n_'), accOrgAdmin, 'biz', 'event', '赛事报名待审核', '「青少年摔跤锦标赛」收到 1 条新报名（演示通知）', 'competition', cmp1, null, T(-1))
  ntIns.run(newId('n_'), accMentor, 'biz', 'course', '课程报名待审核', '「摔跤启蒙训练营」收到新报名（演示通知）', 'course', c1, null, T(-1))
  ntIns.run(newId('n_'), accMentor, 'mentorship', 'auth', '授权待审核', '下级教练发起再授权申请（演示通知）', 'authorization', az2, null, T(-1))
  ntIns.run(newId('n_'), accDemo, 'system', 'invite', '「东方柔道俱乐部」邀请您加入', '来自组织管理员（演示通知）', 'membership', null, null, T(-2))
  ntIns.run(newId('n_'), accDemo, 'system', 'system', '欢迎来到专体工作台', '演示账号已开通（演示通知）', null, null, T(-9), T(-9))

  /* ---------- 设置（五作用域示例） ---------- */
  const setIns = db.prepare('INSERT INTO settings(id, account_id, scope, org_id, device_id, prefs, version, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  setIns.run(newId('set_'), accDemo, 'account', null, null, JSON.stringify({ language: 'zh-CN', timezone: 'Asia/Shanghai' }), 1, T(-9))
  setIns.run(newId('set_'), accDemo, 'privacy', null, null, JSON.stringify({ profile_visibility: 'public', contact_visibility: 'org', achievement_visibility: 'public' }), 1, T(-9))
  setIns.run(newId('set_'), accDemo, 'notify', null, null, JSON.stringify({ channel: { course: true, event: true, mentorship: true, marketing: false } }), 1, T(-9))
  setIns.run(newId('set_'), accOrgAdmin, 'org', org1, null, JSON.stringify({ default_landing: '/workbench', pending_review_alert: true }), 1, T(-9))

  /* ---------- 项目版本历史 ---------- */
  db.prepare('INSERT INTO project_versions(id, project_id, version, change_summary, actor_account_id, snapshot, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    newId('pv_'), P.wrestling, 1, '初始导入（演示种子）', accAdmin, JSON.stringify({ name: '摔跤', slug: 'wrestling' }), T(-270),
  )

  kvSet('perm_version', '1')
  console.log('[seed] 演示种子数据已写入（全部为演示数据）')
  console.log('[seed] 演示账号：admin@local / orgadmin@local / mentor@local / coach@local / demo@local / orgadmin2@local —— 密码统一 demo1234（仅本地）')
}

// 直接运行：tsx db/seed/seed.ts
if (process.argv[1] && process.argv[1].includes('seed')) {
  const { runMigrations } = await import('../../src/db')
  runMigrations()
  seed()
}
