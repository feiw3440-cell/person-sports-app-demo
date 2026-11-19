-- 003：课程商业化底座（阶段五 F-1/F-2）
-- 设计原则：
--   * 全部金额以「分」为单位（amount_cents INTEGER），避免浮点误差
--   * 模拟支付（mock_paid=true 标记），真实支付网关未接入（需单独授权）
--   * 追加式迁移：ALTER TABLE 仅新增列，不修改既有列与数据
--   * 平台服务费率为演示口径（10%），写入订单快照（不随后续费率变化回溯）

-- 课程定价（可空 = 免费课程，走原 enrollments 免费审核流）
ALTER TABLE courses ADD COLUMN price_cents INTEGER;
ALTER TABLE courses ADD COLUMN price_note TEXT;

-- 订单（课程购买）
CREATE TABLE IF NOT EXISTS orders (
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
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (account_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_account ON orders(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_course ON orders(course_id);

-- 资金流水（双端审计口径：每笔资金变动一条，不可修改只可追加）
CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('payment','platform_fee','mentor_income','refund')),
  amount_cents INTEGER NOT NULL,
  memo TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_order ON ledger_entries(order_id);

-- 课程/订单评价（F-3，随迁移一并建表）
CREATE TABLE IF NOT EXISTS reviews (
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

CREATE INDEX IF NOT EXISTS idx_reviews_course ON reviews(course_id, status);

-- 新资源 orders/reviews 的权限行（新增资源类型的授权设计；不修改任何既有权限行）
INSERT OR IGNORE INTO role_permissions(role, resource, action, data_scope) VALUES
  ('user', 'orders', 'read', 'self'),
  ('regular', 'orders', 'read', 'self'),
  ('student', 'orders', 'read', 'self'),
  ('athlete', 'orders', 'read', 'self'),
  ('coach', 'orders', 'read', 'self'),
  ('mentor', 'orders', 'read', 'self'),
  ('org_admin', 'orders', 'read', 'own_org'),
  ('reviewer', 'orders', 'read', 'platform'),
  ('platform_ops', 'orders', 'read', 'platform'),
  ('platform_admin', 'orders', 'read', 'platform'),
  ('user', 'reviews', 'write', 'self'),
  ('regular', 'reviews', 'write', 'self'),
  ('student', 'reviews', 'write', 'self'),
  ('athlete', 'reviews', 'write', 'self'),
  ('coach', 'reviews', 'write', 'self'),
  ('mentor', 'reviews', 'write', 'self');
