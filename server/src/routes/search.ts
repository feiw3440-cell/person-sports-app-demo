// /v1/search：跨实体聚合搜索（项目/内容/人物/课程/赛事/机构），供 APP 全局搜索与 PC 检索共用
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../auth'
import { db } from '../db'
import { mentorGrantedAccountIds, requirePerm, rolesOf } from '../rbac'
import { err } from '../util'

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/search', async (req, reply) => {
    const ctx = requireAuth(req)
    const q = (req.query as { q?: string }).q?.trim()
    if (!q) throw err.validation('缺少搜索关键词 q')
    // 搜索结果中的人物属于 /people 权限域：逐请求实时鉴权 + SQL 数据范围裁剪，
    // 不能因为“搜索”入口而绕过 people.read 的 self/own_org/granted_scope 限制。
    const perm = requirePerm(ctx, 'people', 'read')
    // 课程搜索沿用 /courses 列表的权限与状态规则，避免搜索绕过草稿过滤
    const coursePerm = requirePerm(ctx, 'courses', 'read')
    const roles = rolesOf(ctx)
    const isPlatform = roles.some((r) => ['platform_admin', 'platform_ops'].includes(r))
    const like = `%${q}%`

    const projects = db
      .prepare("SELECT id, name, name_en, intro FROM sports_projects WHERE status = 'active' AND (name LIKE ? OR name_en LIKE ? OR intro LIKE ?) LIMIT 8")
      .all(like, like, like)
    const contents = db
      .prepare("SELECT id, title, type, summary FROM contents WHERE status = 'published' AND (title LIKE ? OR summary LIKE ?) LIMIT 8")
      .all(like, like)
    const peopleWhere: string[] = []
    const peopleArgs: unknown[] = []
    let peopleCanSee = true
    if (perm.data_scope === 'self') {
      peopleWhere.push('p.account_id = ?')
      peopleArgs.push(ctx.accountId)
    } else if (perm.data_scope === 'own_org') {
      if (!ctx.orgId) peopleCanSee = false
      else {
        peopleWhere.push('p.account_id IN (SELECT account_id FROM memberships WHERE org_id = ? AND status = ?)')
        peopleArgs.push(ctx.orgId, 'accepted')
      }
    } else if (perm.data_scope === 'granted_scope') {
      const visible = mentorGrantedAccountIds(ctx)
      if (visible.length === 0) peopleCanSee = false
      else {
        peopleWhere.push(`p.account_id IN (${visible.map(() => '?').join(',')})`)
        peopleArgs.push(...visible)
      }
    }
    // platform/all 不附加范围条件
    const people = peopleCanSee
      ? (db
          .prepare(
            `SELECT p.id, p.kind, p.title, p.region, a.display_name FROM person_profiles p
             JOIN accounts a ON a.id = p.account_id
             WHERE (a.display_name LIKE ? OR p.title LIKE ? OR p.region LIKE ?)
             ${peopleWhere.length ? `AND ${peopleWhere.join(' AND ')}` : ''} LIMIT 8`,
          )
          .all(like, like, like, ...peopleArgs) as Record<string, unknown>[])
      : []
    const courseWhere: string[] = ['c.name LIKE ?']
    const courseArgs: unknown[] = [like]
    let coursesCanSee = true
    if (coursePerm.data_scope === 'self') {
      // 导师仅能搜索自己负责的课程（与 /courses 列表一致）
      courseWhere.push('c.mentor_account_id = ?')
      courseArgs.push(ctx.accountId)
    } else if (coursePerm.data_scope === 'own_org') {
      if (!ctx.orgId) coursesCanSee = false
      else {
        courseWhere.push('c.org_id = ?')
        courseArgs.push(ctx.orgId)
      }
    } else {
      // 公开目录角色：与 /courses 列表一致，不返回未发布草稿
      courseWhere.push("c.status != 'draft'")
    }
    const courses = coursesCanSee
      ? (db
          .prepare(`SELECT c.id, c.name, c.format, c.status FROM courses c WHERE ${courseWhere.join(' AND ')} LIMIT 8`)
          .all(...courseArgs) as Record<string, unknown>[])
      : []
    const competitions = db
      .prepare("SELECT id, name, date_start, location FROM competitions WHERE name LIKE ? OR location LIKE ? LIMIT 8")
      .all(like, like)
    // 机构同样按成员关系裁剪：平台角色可检索全部，其他账号仅能检索自己所属机构
    const orgWhere = ["status = 'active'", '(name LIKE ? OR intro LIKE ?)']
    const orgArgs: unknown[] = [like, like]
    if (!isPlatform) {
      orgWhere.push("id IN (SELECT org_id FROM memberships WHERE account_id = ? AND status IN ('pending','accepted'))")
      orgArgs.push(ctx.accountId)
    }
    const organizations = db
      .prepare(`SELECT id, name, type, region FROM organizations WHERE ${orgWhere.join(' AND ')} LIMIT 8`)
      .all(...orgArgs)

    return reply.send({
      data: {
        keyword: q,
        projects,
        contents,
        people,
        courses,
        competitions,
        organizations,
      },
      meta: { counts: { projects: projects.length, contents: contents.length, people: people.length, courses: courses.length, competitions: competitions.length, organizations: organizations.length } },
    })
  })
}
