-- 007：阶段五 F 专项整改 P2-03 收藏 500 修复
-- 根因：reactions.content_id 外键仅指向 contents(id)，APP 项目详情页收藏传入项目 ID(p_...) 触发
--       SQLITE_CONSTRAINT_FOREIGNKEY，未捕获 → HTTP 500，收藏无法真实持久化。
-- 方案：reaction 改为多态目标（与 follows 的 target_type/target_id 设计一致），支持 content 与 project。
--       外键约束改由路由层按 target_type 校验目标存在（contents / sports_projects），避免悬空数据。
-- 本迁移仅重建 reactions 表并原样回填既有数据（content 目标），不删改其他任何数据。

-- ===== 1) 事务内一致性备份 =====
CREATE TABLE reactions_bak007 AS
  SELECT id, content_id, account_id, kind, created_at FROM reactions;

DROP TABLE reactions;

-- ===== 2) 重建 reactions（多态目标） =====
CREATE TABLE reactions (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('content','project')),
  target_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  kind TEXT NOT NULL CHECK (kind IN ('like','fav')),
  created_at TEXT NOT NULL,
  UNIQUE (target_type, target_id, account_id, kind)
);
-- 回填：既有行均为 content 目标，原文不变
INSERT INTO reactions (id, target_type, target_id, account_id, kind, created_at)
  SELECT id, 'content', content_id, account_id, kind, created_at FROM reactions_bak007;
DROP TABLE reactions_bak007;
CREATE INDEX idx_reactions_target ON reactions(target_type, target_id);
CREATE INDEX idx_reactions_account ON reactions(account_id);
