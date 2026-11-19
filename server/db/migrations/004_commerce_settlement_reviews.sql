-- 004：阶段五 F-2/F-3/F-4 商业化闭环扩展（追加式迁移；不修改 001/002/003）
-- 原则：
--   * 金额仍以整数分存储；结算金额全部由服务端按订单快照计算
--   * 历史订单/流水不删除；orders 重建仅为移除 003 的 UNIQUE(account_id, course_id)
--     （该约束会使退款/取消后无法重新购买），改为「仅活动订单唯一」的部分唯一索引
--   * 结算为模拟口径：不触发真实资金划转；结算项对订单唯一，天然防重复结算
--   * 评价新增读/管理权限；创建资格由服务端校验 paid 订单（见 routes/reviews.ts）
--   * 平台服务费率写入 kv_meta（默认 0.10），仅作演示参数，最终费率待产品决策

-- ===== 1) orders 重建：允许退款/取消后重新下单，历史订单保留 =====
-- 重建顺序：先备份流水 → 删旧流水/旧订单（避免悬空外键）→ 重命名新订单 → 建新流水并回填
CREATE TABLE orders_new (
  id TEXT PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  course_id TEXT NOT NULL REFERENCES courses(id),
  class_id TEXT REFERENCES classes(id),
  amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  mentor_amount_cents INTEGER NOT NULL DEFAULT 0,
  fee_rate_snapshot TEXT NOT NULL DEFAULT '0.10',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','refund_requested','refunded','cancelled')),
  mock_paid INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT,
  refunded_at TEXT,
  refund_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
INSERT INTO orders_new (id, order_no, account_id, course_id, class_id, amount_cents, platform_fee_cents, mentor_amount_cents, fee_rate_snapshot, status, mock_paid, paid_at, refunded_at, refund_reason, created_at, updated_at, version)
SELECT id, order_no, account_id, course_id, class_id, amount_cents, platform_fee_cents, mentor_amount_cents, fee_rate_snapshot, status, mock_paid, paid_at, refunded_at, refund_reason, created_at, updated_at, version
FROM orders;

CREATE TABLE ledger_entries_backup AS
SELECT id, order_id, entry_type, amount_cents, memo, created_at FROM ledger_entries;
CREATE TABLE reviews_backup AS
SELECT id, course_id, order_id, account_id, rating, comment, status, created_at, updated_at, version FROM reviews;

-- 先删子表（流水/评价），再删父表（订单），最后按原名重建并回填；避免外键悬空
DROP TABLE ledger_entries;
DROP TABLE reviews;
DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;

CREATE TABLE ledger_entries (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('payment','platform_fee','mentor_income','refund')),
  amount_cents INTEGER NOT NULL,
  memo TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO ledger_entries (id, order_id, entry_type, amount_cents, memo, created_at)
SELECT id, order_id, entry_type, amount_cents, memo, created_at FROM ledger_entries_backup;
DROP TABLE ledger_entries_backup;

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (order_id)
);
INSERT INTO reviews (id, course_id, order_id, account_id, rating, comment, status, created_at, updated_at, version)
SELECT id, course_id, order_id, account_id, rating, comment, status, created_at, updated_at, version FROM reviews_backup;
DROP TABLE reviews_backup;
CREATE INDEX IF NOT EXISTS idx_reviews_course ON reviews(course_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_account ON orders(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_course ON orders(course_id);
-- 同一账号同一课程最多一笔“进行中”订单；退款/取消后可重新下单，历史订单保留
CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_active_course
  ON orders(account_id, course_id) WHERE status IN ('created','paid','refund_requested');
CREATE INDEX IF NOT EXISTS idx_ledger_order ON ledger_entries(order_id);

-- ===== 2) 评价：同一课程同一账号仅一条（防重复评价） =====
CREATE UNIQUE INDEX IF NOT EXISTS ux_reviews_course_account ON reviews(course_id, account_id);

-- ===== 3) 模拟结算 =====
CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  settlement_no TEXT NOT NULL UNIQUE,
  mentor_account_id TEXT NOT NULL REFERENCES accounts(id),
  org_id TEXT REFERENCES organizations(id),
  gross_amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  mentor_amount_cents INTEGER NOT NULL,
  order_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'settled' CHECK (status IN ('settled')),
  period_start TEXT,
  period_end TEXT,
  settled_by TEXT NOT NULL REFERENCES accounts(id),
  settled_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_settlements_mentor ON settlements(mentor_account_id, settled_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlements_org ON settlements(org_id, settled_at DESC);

CREATE TABLE IF NOT EXISTS settlement_items (
  id TEXT PRIMARY KEY,
  settlement_id TEXT NOT NULL REFERENCES settlements(id),
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  course_id TEXT NOT NULL REFERENCES courses(id),
  amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  mentor_amount_cents INTEGER NOT NULL,
  paid_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_settlement_items_settlement ON settlement_items(settlement_id);

-- ===== 4) 新资源权限（只追加，不改既有权限行） =====
INSERT OR IGNORE INTO role_permissions(role, resource, action, data_scope) VALUES
  ('user', 'reviews', 'read', 'platform'),
  ('regular', 'reviews', 'read', 'platform'),
  ('student', 'reviews', 'read', 'platform'),
  ('athlete', 'reviews', 'read', 'platform'),
  ('coach', 'reviews', 'read', 'platform'),
  ('mentor', 'reviews', 'read', 'platform'),
  ('org_admin', 'reviews', 'read', 'platform'),
  ('platform_admin', 'reviews', 'read', 'platform'),
  ('platform_ops', 'reviews', 'read', 'platform'),
  ('reviewer', 'reviews', 'read', 'platform'),
  ('mentor', 'reviews', 'moderate', 'granted_scope'),
  ('coach', 'reviews', 'moderate', 'granted_scope'),
  ('org_admin', 'reviews', 'moderate', 'own_org'),
  ('platform_admin', 'reviews', 'moderate', 'platform'),
  ('platform_ops', 'reviews', 'moderate', 'platform'),
  ('reviewer', 'reviews', 'moderate', 'platform'),
  ('mentor', 'revenue', 'read', 'self'),
  ('mentor', 'revenue', 'settle', 'self'),
  ('coach', 'revenue', 'read', 'self'),
  ('coach', 'revenue', 'settle', 'self'),
  ('org_admin', 'revenue', 'read', 'own_org'),
  ('org_admin', 'revenue', 'settle', 'own_org'),
  ('platform_admin', 'revenue', 'read', 'platform'),
  ('platform_admin', 'revenue', 'settle', 'platform'),
  ('platform_ops', 'revenue', 'read', 'platform'),
  ('platform_ops', 'revenue', 'settle', 'platform'),
  ('reviewer', 'revenue', 'read', 'platform');

-- ===== 5) 平台服务费率（演示参数，待产品决策；服务端为唯一读取方） =====
INSERT OR IGNORE INTO kv_meta(key, value) VALUES ('platform_fee_rate', '0.10');
