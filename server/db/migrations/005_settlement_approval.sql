-- 005：阶段五 F P1-03 结算申请/审批分离（状态机）
-- 背景：004 的 settlements.status CHECK 仅允许 'settled'，且 mentor/coach 的 revenue.settle=self
--       使导师可一步自批自结。本迁移在【不删除任何历史结算单】的前提下扩展状态模型。
-- 原则：
--   * 历史结算单（status='settled'）原样保留 settled_by / settled_at；applied_by 置 NULL 表示历史遗留申请人未知
--   * 状态机：pending（申请）→ settled（审批通过）/ rejected（驳回）；settled 为终态
--   * 审批权限：机构仅本组织（org_admin=own_org）、平台按授权（platform_admin/ops=platform）
--   * 导师/教练【无 approve 权限】，从权限表层面杜绝自批自结（服务端仍做二次强校验）
--   * settlement_items.order_id UNIQUE 保留：同一订单只能被一个结算单引用（唯一约束防重复）

-- ===== 1) settlements 重建：扩展 status CHECK，新增申请/驳回字段 =====
CREATE TABLE settlements_new (
  id TEXT PRIMARY KEY,
  settlement_no TEXT NOT NULL UNIQUE,
  mentor_account_id TEXT NOT NULL REFERENCES accounts(id),
  org_id TEXT REFERENCES organizations(id),
  gross_amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  mentor_amount_cents INTEGER NOT NULL,
  order_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','settled','rejected')),
  period_start TEXT,
  period_end TEXT,
  applied_by TEXT REFERENCES accounts(id),
  applied_at TEXT,
  settled_by TEXT REFERENCES accounts(id),
  settled_at TEXT,
  reject_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

-- 历史数据回填：settled_by / settled_at 原样保留；applied_at 以 settled_at 兜底（历史申请人未知）
INSERT INTO settlements_new (
  id, settlement_no, mentor_account_id, org_id, gross_amount_cents, platform_fee_cents,
  mentor_amount_cents, order_count, status, period_start, period_end,
  applied_by, applied_at, settled_by, settled_at, reject_reason, created_at, updated_at, version
)
SELECT
  id, settlement_no, mentor_account_id, org_id, gross_amount_cents, platform_fee_cents,
  mentor_amount_cents, order_count, status, period_start, period_end,
  NULL, settled_at, settled_by, settled_at, NULL, created_at, updated_at, version
FROM settlements;

-- 子表先备份再删除，避免父表替换导致外键悬空（沿用 004 的重建顺序）
CREATE TABLE settlement_items_backup AS
SELECT id, settlement_id, order_id, course_id, amount_cents, platform_fee_cents, mentor_amount_cents, paid_at, created_at
FROM settlement_items;

DROP TABLE settlement_items;
DROP TABLE settlements;
ALTER TABLE settlements_new RENAME TO settlements;

CREATE TABLE settlement_items (
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
INSERT INTO settlement_items (
  id, settlement_id, order_id, course_id, amount_cents, platform_fee_cents, mentor_amount_cents, paid_at, created_at
)
SELECT id, settlement_id, order_id, course_id, amount_cents, platform_fee_cents, mentor_amount_cents, paid_at, created_at
FROM settlement_items_backup;
DROP TABLE settlement_items_backup;

CREATE INDEX IF NOT EXISTS idx_settlements_mentor ON settlements(mentor_account_id, COALESCE(settled_at, applied_at) DESC);
CREATE INDEX IF NOT EXISTS idx_settlements_org ON settlements(org_id, COALESCE(settled_at, applied_at) DESC);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status, settlement_no);
CREATE INDEX IF NOT EXISTS idx_settlement_items_settlement ON settlement_items(settlement_id);

-- ===== 2) 审批权限（只追加；不授予 mentor/coach，杜绝自批自结） =====
INSERT OR IGNORE INTO role_permissions(role, resource, action, data_scope) VALUES
  ('org_admin', 'revenue', 'approve', 'own_org'),
  ('platform_admin', 'revenue', 'approve', 'platform'),
  ('platform_ops', 'revenue', 'approve', 'platform');

-- 说明：历史自结单 st_gDoEb89yu8ir 的 settled_by 仍为导师本人，作为“整改前证据”原样保留，
--       不因本迁移而改写；其 status='settled' 为终态，无法再被审批。
