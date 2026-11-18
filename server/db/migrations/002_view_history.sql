-- 002：浏览历史（阶段五 E-4）
-- 记录登录用户对公开实体的浏览行为；同一用户同一实体仅一条（重复浏览更新 viewed_at），
-- 避免表无限膨胀；不记录搜索词、停留时长等隐私敏感维度。
-- 追加式迁移：不修改既有表与数据。

CREATE TABLE IF NOT EXISTS view_history (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('content','course','competition','profile','project','org')),
  target_id TEXT NOT NULL,
  viewed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (account_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_view_history_account ON view_history(account_id, viewed_at DESC);
