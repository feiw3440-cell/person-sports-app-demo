// GitHub Pages REST API 部署（github.com:443 不可达时的备选通道）
// 流程：git credential fill 取 GCM 令牌（不打印不落盘）→ blobs → tree → commit → force PATCH refs
// 用法：node tools/ghp-deploy-api.mjs <本地ghp目录> <commit消息>
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const [,, localDir, commitMsg] = process.argv
const REPO = 'feiw3440-cell/person-sports-app-demo'
const BRANCH = 'gh-pages'
const API = 'https://api.github.com'

// 1. 取 GCM 令牌（凭据来自 Windows 凭据管理器，不输出）
const cred = execSync('printf "protocol=https\\nhost=github.com\\n\\n" | git credential fill', { encoding: 'utf8', shell: 'bash' })
const token = cred.split('\n').find((l) => l.startsWith('password='))?.slice(9)
if (!token) { console.error('NO-TOKEN'); process.exit(1) }

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
  'User-Agent': 'zt-pages-deploy',
}
const api = async (method, url, body) => {
  const res = await fetch(API + url, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${JSON.stringify(json).slice(0, 200)}`)
  return json
}

// 2. 远程基线（gh-pages 当前 commit/tree；不存在则全新）
const refUrl = `/repos/${REPO}/git/ref/heads/${BRANCH}`
let baseCommitSha = null, baseTreeSha = null
try {
  const ref = await api('GET', refUrl)
  baseCommitSha = ref.object.sha
  const c = await api('GET', `/repos/${REPO}/git/commits/${baseCommitSha}`)
  baseTreeSha = c.tree.sha
  console.log('base commit:', baseCommitSha)
} catch (e) {
  console.log('远程无 gh-pages 基线（全新创建）')
}

// 3. 收集文件（排除 .git）→ blobs
function walk(dir, prefix = '') {
  const items = []
  for (const name of fs.readdirSync(dir)) {
    if (name === '.git') continue
    const full = path.join(dir, name)
    const rel = prefix ? `${prefix}/${name}` : name
    const st = fs.statSync(full)
    if (st.isDirectory()) items.push(...walk(full, rel))
    else items.push({ rel, full, size: st.size })
  }
  return items
}
const files = walk(localDir)
console.log(`文件数: ${files.length}，总大小: ${(files.reduce((n, f) => n + f.size, 0) / 1024).toFixed(0)}KB`)

const treeItems = []
for (const f of files) {
  const content = fs.readFileSync(f.full)
  const blob = await api('POST', `/repos/${REPO}/git/blobs`, { content: content.toString('base64'), encoding: 'base64' })
  treeItems.push({ path: f.rel.replace(/\\/g, '/'), mode: '100644', type: 'blob', sha: blob.sha })
  console.log('  blob:', f.rel)
}

// 4. tree → commit → force ref
const tree = await api('POST', `/repos/${REPO}/git/trees`, baseTreeSha ? { base_tree: baseTreeSha, tree: treeItems } : { tree: treeItems })
const commit = await api('POST', `/repos/${REPO}/git/commits`, {
  message: commitMsg || 'deploy via API',
  tree: tree.sha,
  parents: baseCommitSha ? [baseCommitSha] : [],
})
await api('PATCH', `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: true })
console.log('DEPLOYED:', commit.sha)
