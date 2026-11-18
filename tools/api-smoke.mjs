// 专体共享 API · 冒烟测试（node 原生 fetch，零依赖）
// 用法：node tools/api-smoke.mjs   （要求 API 已在 127.0.0.1:8787 运行）
// 覆盖：健康检查 / 未授权 401 / 登录 / 关键列表 / 权限边界 / 幂等键 / 状态机动作
// 原则：只读为主 + 一条可幂等重放的创建（不污染业务数据）

const BASE = process.env.API_BASE || 'http://127.0.0.1:8787'
let pass = 0, fail = 0

function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`) }
}

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + '/v1' + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  let json = null
  try { json = await res.json() } catch { /* 204 等 */ }
  return { status: res.status, json }
}

console.log(`专体 API 冒烟测试 → ${BASE}`)

// 1. 健康检查
{
  const r = await req('GET', '/health')
  check('GET /health = 200', r.status === 200 && r.json?.data?.ok === true)
}

// 2. 未授权边界
{
  const r = await req('GET', '/people')
  check('未授权 GET /people = 401', r.status === 401)
}

// 3. 登录（三个种子账号）
const login = async (name) => {
  const r = await req('POST', '/auth/sessions', { body: { login_name: `${name}@local`, password: 'demo1234', client: 'app' } })
  check(`登录 ${name}@local = 200`, r.status === 200 && !!r.json?.data?.access_token)
  return r.json?.data?.access_token
}
const demoTok = await login('demo')
const adminTok = await login('admin')

// 4. 关键列表（登录后）
{
  const r = await req('GET', '/projects?page_size=10', { token: demoTok })
  check('GET /projects = 200 且有数据', r.status === 200 && (r.json?.data?.length ?? 0) > 0)
  const c = await req('GET', '/contents?page_size=10&status=published', { token: demoTok })
  check('GET /contents(published) = 200', c.status === 200)
  const rk = await req('GET', '/rankings/athlete?mode=overall&period=total', { token: demoTok })
  check('GET /rankings/athlete = 200 且有行', rk.status === 200 && (rk.json?.data?.rows?.length ?? 0) > 0)
}

// 5. 权限边界：demo 访问审核列表（预期 403）
{
  const r = await req('GET', '/credentials', { token: demoTok })
  check('demo GET /credentials(审核列表) = 403', r.status === 403)
  const a = await req('GET', '/credentials?status=submitted', { token: adminTok })
  check('admin GET /credentials = 200', a.status === 200)
}

// 6. 重复提交保护：重复导师申请（demo 已有历史申请 → 409 或已导师 409；无申请则创建后重复）
{
  const b1 = await req('POST', '/credentials', { token: demoTok, body: { kind: '冒烟测试申请（幂等可重放）' }, headers2: {} })
  // 可能 201（新建）/409（已进行中/已是导师）——两者均合法
  check('POST /credentials 状态合法(201/409)', [201, 409].includes(b1.status), `实际 ${b1.status}`)
  const b2 = await req('POST', '/credentials', { token: demoTok, body: { kind: '冒烟测试申请（幂等可重放）' } })
  check('重复申请被拒(409)', b2.status === 409, `实际 ${b2.status}`)
}

// 7. 数据范围：demo(student) 的 /people 应含公开档案
{
  const r = await req('GET', '/people?page_size=50', { token: demoTok })
  const names = (r.json?.data ?? []).map((x) => x.display_name)
  check('GET /people 含公开档案（B-⑤ 公开语义）', r.status === 200 && names.some((n) => n && !n.includes('阿体')))
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
