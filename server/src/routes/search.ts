// /v1/search：跨实体聚合搜索（项目/内容/人物/课程/赛事/机构），供 APP 全局搜索与 PC 检索共用
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../auth'
import { db } from '../db'
import { err } from '../util'

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/search', async (req, reply) => {
    requireAuth(req)
    const q = (req.query as { q?: string }).q?.trim()
    if (!q) throw err.validation('缺少搜索关键词 q')
    const like = `%${q}%`

    const projects = db
      .prepare("SELECT id, name, name_en, intro FROM sports_projects WHERE status = 'active' AND (name LIKE ? OR name_en LIKE ? OR intro LIKE ?) LIMIT 8")
      .all(like, like, like)
    const contents = db
      .prepare("SELECT id, title, type, summary FROM contents WHERE status = 'published' AND (title LIKE ? OR summary LIKE ?) LIMIT 8")
      .all(like, like)
    const people = db
      .prepare(
        `SELECT p.id, p.kind, p.title, p.region, a.display_name FROM person_profiles p
         JOIN accounts a ON a.id = p.account_id WHERE (a.display_name LIKE ? OR p.title LIKE ? OR p.region LIKE ?) LIMIT 8`,
      )
      .all(like, like, like)
    const courses = db
      .prepare("SELECT id, name, format, status FROM courses WHERE status IN ('published','draft') AND name LIKE ? LIMIT 8")
      .all(like)
    const competitions = db
      .prepare("SELECT id, name, date_start, location FROM competitions WHERE name LIKE ? OR location LIKE ? LIMIT 8")
      .all(like, like)
    const organizations = db
      .prepare("SELECT id, name, type, region FROM organizations WHERE status = 'active' AND (name LIKE ? OR intro LIKE ?) LIMIT 8")
      .all(like, like)

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
