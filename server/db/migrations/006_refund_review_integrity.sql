-- 006：阶段五 F 专项整改 P2-01 / P2-02 数据完整性迁移
-- P2-01：reviews.status 增加 'refunded' —— 订单退款后，评价原文保留（不物理删除），但不计入公开评分；留审计。
--         公开列表/课程详情评分仅统计 status='visible'，故 refunded 自动被排除，无需改聚合 SQL。
-- P2-02：ledger_entries.entry_type 增加 'platform_fee_refund' / 'mentor_income_refund'
--         —— 退款时平台服务费与导师收入分别冲减（金额以 entry_type 表方向，均为正数）。
-- 幂等：每订单每类退款相关流水最多一条（部分唯一索引兜底，防止重复退款/并发重复写账）。
-- 本迁移不修改、不删除任何既有订单/流水/评价/结算/迁移记录；仅重建两张表以扩展 CHECK 约束并回填原样数据。

-- ===== 1) 事务内一致性备份（备份表无外键，置于同一原子事务） =====
CREATE TABLE ledger_entries_bak006 AS
  SELECT id, order_id, entry_type, amount_cents, memo, created_at FROM ledger_entries;
CREATE TABLE reviews_bak006 AS
  SELECT id, course_id, order_id, account_id, rating, comment, status, created_at, updated_at, version FROM reviews;

-- 先删子表再重建（两表互不引用；父表 orders/courses/accounts 不动）
DROP TABLE ledger_entries;
DROP TABLE reviews;

-- ===== 2) 重建 ledger_entries（扩展 entry_type CHECK） =====
CREATE TABLE ledger_entries (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  entry_type TEXT NOT NULL CHECK (entry_type IN
    ('payment','platform_fee','mentor_income','refund','platform_fee_refund','mentor_income_refund')),
  amount_cents INTEGER NOT NULL,
  memo TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO ledger_entries (id, order_id, entry_type, amount_cents, memo, created_at)
  SELECT id, order_id, entry_type, amount_cents, memo, created_at FROM ledger_entries_bak006;
DROP TABLE ledger_entries_bak006;
CREATE INDEX idx_ledger_order ON ledger_entries(order_id);
-- 退款/冲减流水幂等：每订单每类最多一条
CREATE UNIQUE INDEX ux_ledger_refund_once ON ledger_entries(order_id, entry_type)
  WHERE entry_type IN ('refund','platform_fee_refund','mentor_income_refund');

-- ===== 3) 重建 reviews（扩展 status CHECK） =====
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','refunded')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (order_id)
);
INSERT INTO reviews (id, course_id, order_id, account_id, rating, comment, status, created_at, updated_at, version)
  SELECT id, course_id, order_id, account_id, rating, comment, status, created_at, updated_at, version FROM reviews_bak006;
DROP TABLE reviews_bak006;
CREATE INDEX idx_reviews_course ON reviews(course_id, status);
CREATE UNIQUE INDEX ux_reviews_course_account ON reviews(course_id, account_id);
