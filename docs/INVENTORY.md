# 专体 APP 仓库盘点报告（一体化改造前置盘点）

> 盘点时间：2026-11-18 · 盘点人：开发工具（ZCode）
> 标注约定：【已验证】= 本次实际运行/读取确认；【推断】= 基于代码/文档合理推断；【缺失】= 不存在或未实现

## 1. APP 端（`app/` 根目录 = 仓库根）

| 项 | 结果 | 标注 |
|---|---|---|
| 框架/版本 | Vite 5 + React 18.3 + TypeScript 5.6 + Zustand 5（HashRouter） | 【已验证】package.json + node_modules |
| Node/npm | Node 24 / npm 11（构建与 dev 均可运行） | 【已验证】 |
| 运行命令 | `npm run dev`(5173) / `npm run build` / `npm run preview` | 【已验证】 |
| 目录 | `src/{pages,components,data,services,store,styles}` + `public/img`（原型裁切图）+ `docs/` | 【已验证】 |
| 路由 | HashRouter，22 条路由：`/` `/discover` `/publish` `/top` `/top/rank/:category` `/messages` `/me` `/search` `/list/:type` `/project/:id` `/content/:id` `/athlete/:id` `/mentor/:id` `/course/:id` `/event/:id` `/org/:id` `/identity` `/mentor-apply` `/mentorship` `/authorization/:id` `/admin` `/states` `/about` | 【已验证】App.tsx |
| 状态管理 | Zustand（`store.ts`）：当前身份 currentRoleId、follows/likes/favs、readMsgs、mentorApplyStatus、toasts；**persist 到 localStorage**（键 `zhuan-ti-demo-v2`） | 【已验证】 |
| 数据源 | **静态 Mock**：`src/data/db.ts`（约 1100 行：8 项目、13 内容、13 人物、7 课程、6 赛事、4 机构、师徒/授权、榜单池、消息）；组件直接 import 常量 | 【已验证】 |
| localStorage 清单 | 会话/身份指针、互动状态、消息已读、申请状态（zustand persist）；**无令牌、无 .env、无数据库** | 【已验证】 |
| API 层 | **无真实 API 调用**；`services/api.ts` 为本地榜单计算/搜索的纯函数 | 【已验证】 |
| 视觉稿 | 五大主页按用户原型 1:1 还原；图片为原型裁切（`public/img/`，25 张） | 【已验证】 |
| Git | 分支 main；远程 origin = person-sports-app-demo（public）；历史：aad9100 → 0414a48 | 【已验证】 |

## 2. 共享后端（`app/server/`，已存在于仓库工作树，非本次创建）

| 项 | 结果 | 标注 |
|---|---|---|
| 框架 | Fastify 4 + @fastify/cors + better-sqlite3；TS + tsx 运行 | 【已验证】package.json + node_modules 已安装 |
| 启动 | `npm run start`（tsx src/index.ts）:8787；健康检查 `/v1/health` 200 | 【已验证】本次启动成功 |
| 数据库 | SQLite `server/data/app.db`；**50 张表**；`schema_migrations` 迁移表；CLI：migrate/rollback/seed/reset/backup | 【已验证】sqlite3 直查 |
| 种子数据 | `db/seed/seed.ts`：9 演示账号（demo@local 等，密码 demo1234）、identities 11、memberships 8、organizations 2、contents 5、courses 4、competitions 4、enrollments 4、notifications 8、authorizations 2、mentorships 2、audit_logs 6……语义映射自 APP db.ts | 【已验证】seed.ts 源码 + 数据库行数 |
| 端点 | **80+ 端点**，覆盖 PRD V2.0 F 表建议全部：auth/sessions(+refresh/context)、me、me/settings、projects(+branches/units/versions/dictionaries)、contents(+actions/rankings)、people(+credentials/export)、courses(+classes/actions)、competitions(+registrations/selections/schedule/results/actions)、enrollments(+actions)、mentorships、authorizations(+actions)、organizations(+members/invitations)、notifications(+read)、analytics(workbench/overview/export)、admin(accounts/audit-logs) | 【已验证】grep 端点清单 + curl 抽测（登录/projects/enrollments/notifications 均 200） |
| 横切能力 | JWT 访问+刷新令牌、RBAC（role_permissions + 逐请求 requirePerm + data_scope）、audit_logs、幂等键表（idempotency_keys）、outbox_events、statemachine（状态机流转） | 【已验证】源码与表 |
| 缺口 | ① 无关注/点赞/收藏（follows/reactions/comments 表存在但**无路由**）② rankings/athletes 返回 empty（榜单定义/快照种子缺失）③ 无搜索聚合端点（分端搜索可满足）④ 无内容评论路由（comments 表存在）⑤ 无上传/媒体路由（media_files 表存在） | 【已验证】端点清单比对 |

## 3. PRD（GitHub 双端集成版）要点映射

| PRD 要求 | 现状 | 行动 |
|---|---|---|
| 统一账号/身份/组织/权限/后端/数据库 | server 已实现（accounts/identities/memberships/organizations/rbac） | 接入 APP/PC |
| APP 登录会话；登录后拉取上下文 | server 有 /v1/auth/*；APP 无登录页 | 新增登录页 + 会话管理 |
| APP 数据走共享 API；Mock 仅开发隔离 | APP 全静态 | 数据层适配（Mock 开关保留） |
| 报名/审核闭环（幂等键、服务端权威） | server 有 registrations/enrollments/actions + 幂等表 | APP 报名 + PC 审核 + 闭环验证 |
| 通知按事件产生、已读按类型同步 | server 有 notifications + read 路由 | APP 消息中心接 API |
| 设置分层（账号/隐私/通知偏好共享；组织偏好；设备本地） | server 有 me/settings（JSON 存储） | APP 设置页接 API |
| PC 工作台（形态 B：管理优先） | **缺失** | 新建 pc/ |
| 榜单定义/快照、透明口径 | server 有 rankings 路由但种子缺 | 补种子 |
| 互动（关注/收藏/点赞）双端共用 | 表存在、路由缺 | server 补路由 + APP 接入 |
| 幂等键重试 | 表存在；中间件实现待核实 | server 补 Idempotency-Key 处理 |

## 4. 结论

- **无需重建 APP**：现有 APP + 现有 server 组合已具备一体化基础，缺的是「APP 数据层接入 + PC 端 + 少量后端补缺 + 闭环验证」。
- 采用**增量改造**：保留五大导航、页面结构、视觉与交互；数据层以适配层接入共享 API；localStorage 仅保留会话令牌与设备设置。
- 仓库策略：**在现有仓库增量提交**（保留历史），目录约定：`server/`（共享 API）+ `pc/`（PC 工作台）+ `database`（迁移/种子在 server/db 内）。仓库名保留 `person-sports-app-demo`（改名会破坏已发布 Pages 链接；如需 person-sports-platform 可后续在 GitHub 设置中改名）。
