// 共享后端入口：Fastify :8787 · 唯一权威 API（APP 与 PC 共用）
import os from 'node:os'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { runMigrations, db } from './db'
import { seed } from '../db/seed/seed'
import { HttpError } from './util'
import { authRoutes } from './routes/auth'
import { organizationRoutes } from './routes/organizations'
import { projectRoutes } from './routes/projects'
import { peopleRoutes } from './routes/people'
import { courseRoutes } from './routes/courses'
import { competitionRoutes } from './routes/competitions'
import { mentorshipRoutes } from './routes/mentorship'
import { contentRoutes } from './routes/contents'
import { interactionRoutes } from './routes/interactions'
import { searchRoutes } from './routes/search'
import { miscRoutes } from './routes/misc'

const PORT = Number(process.env.PORT || 8787)

/* 启动门禁：先迁移，再种子（幂等） */
const ran = runMigrations()
if (ran.length) console.log(`[migrate] 已应用：${ran.join(', ')}`)
seed()

const app = Fastify({ logger: false })

/* 本地 Demo CORS：允许 APP(5173) 与 PC(5174) 及本机变体 */
await app.register(cors, {
  origin: [/^https?:\/\/(localhost|127\.0\.0\.1):(5173|5174)$/],
})

/* 统一错误封装 */
app.setErrorHandler((error, _req, reply) => {
  if (error instanceof HttpError) {
    return reply.code(error.status).send({ error: { code: error.code, message: error.message, details: error.details } })
  }
  if ((error as { validation?: unknown }).validation) {
    return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: (error as Error).message } })
  }
  console.error('[server] 未处理错误：', error)
  return reply.code(500).send({ error: { code: 'INTERNAL', message: '服务器内部错误' } })
})

/* 404：返回统一错误封装 */
app.setNotFoundHandler((_req, reply) => {
  reply.code(404).send({ error: { code: 'NOT_FOUND', message: '接口不存在' } })
})

app.get('/v1/health', async () => ({ data: { ok: true, service: 'person-sports-api', time: new Date().toISOString() } }))

await app.register(authRoutes, { prefix: '/v1' })
await app.register(organizationRoutes, { prefix: '/v1' })
await app.register(projectRoutes, { prefix: '/v1' })
await app.register(peopleRoutes, { prefix: '/v1' })
await app.register(courseRoutes, { prefix: '/v1' })
await app.register(competitionRoutes, { prefix: '/v1' })
await app.register(mentorshipRoutes, { prefix: '/v1' })
await app.register(contentRoutes, { prefix: '/v1' })
await app.register(interactionRoutes, { prefix: '/v1' })
await app.register(searchRoutes, { prefix: '/v1' })
await app.register(miscRoutes, { prefix: '/v1' })

await app.listen({ port: PORT, host: '0.0.0.0' })
const lanAddr = Object.values(os.networkInterfaces())
  .flat()
  .find((a) => a && a.family === 'IPv4' && !a.internal)?.address
console.log(`[server] 专体共享 API 已启动：http://127.0.0.1:${PORT}/v1`)
if (lanAddr) console.log(`[server] 局域网地址（实体手机 APP 的 VITE_API_BASE 使用）：http://${lanAddr}:${PORT}/v1`)
void db
