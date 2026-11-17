-- 001_init.sql · 专体共享权威库 V1（对应 docs/platform/01-数据字典.md）
-- 约定：id TEXT(服务端生成) / created_at TEXT ISO / updated_at TEXT ISO / version INTEGER 乐观锁

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE kv_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ============ 认证与身份域 ============
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  login_name TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  locale TEXT DEFAULT 'zh-CN',
  timezone TEXT DEFAULT 'Asia/Shanghai',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE refresh_sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  client TEXT NOT NULL CHECK (client IN ('app','pc')),
  token_hash TEXT NOT NULL,
  org_id TEXT,
  identity_id TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  revoked_reason TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_refresh_sessions_account ON refresh_sessions(account_id);

CREATE TABLE identities (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  identity_type TEXT NOT NULL CHECK (identity_type IN
    ('regular','student','athlete','coach','mentor','org_admin','org_member',
     'event_organizer','content_editor','reviewer','platform_ops','platform_admin')),
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','rejected','disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (account_id, identity_type)
);

CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES identities(id),
  kind TEXT NOT NULL,
  source TEXT NOT NULL,
  evidence TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','under_review','approved','rejected','resubmitted')),
  valid_until TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

-- ============ 组织与权限域 ============
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('club','school','venue','association')),
  parent_id TEXT REFERENCES organizations(id),
  region TEXT NOT NULL,
  intro TEXT,
  contact TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE memberships (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  role TEXT NOT NULL CHECK (role IN ('org_admin','coach','member','athlete')),
  position TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired','revoked')),
  valid_until TEXT,
  invited_by TEXT,
  decided_at TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (account_id, org_id)
);

CREATE TABLE role_permissions (
  role TEXT NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  data_scope TEXT NOT NULL CHECK (data_scope IN ('self','own_org','granted_scope','platform','all')),
  PRIMARY KEY (role, resource, action)
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_account_id TEXT REFERENCES accounts(id),
  actor_identity_type TEXT,
  org_id TEXT,
  client TEXT NOT NULL DEFAULT 'server' CHECK (client IN ('app','pc','server')),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  before_json TEXT,
  after_json TEXT,
  reason TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

CREATE TABLE idempotency_keys (
  account_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (account_id, endpoint, key)
);

CREATE TABLE outbox_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  target_account_id TEXT,
  dispatched_at TEXT,
  created_at TEXT NOT NULL
);

-- ============ 体育项目域 ============
CREATE TABLE sports_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  slug TEXT NOT NULL UNIQUE,
  intro TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','deprecated')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE project_categories ( id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE );
CREATE TABLE project_tags ( id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE );
CREATE TABLE project_category_links (
  project_id TEXT NOT NULL REFERENCES sports_projects(id),
  category_id TEXT NOT NULL REFERENCES project_categories(id),
  PRIMARY KEY (project_id, category_id)
);
CREATE TABLE project_tag_links (
  project_id TEXT NOT NULL REFERENCES sports_projects(id),
  tag_id TEXT NOT NULL REFERENCES project_tags(id),
  PRIMARY KEY (project_id, tag_id)
);

CREATE TABLE project_branches (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES sports_projects(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, name)
);

CREATE TABLE competition_units (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES project_branches(id),
  name TEXT NOT NULL,
  gender TEXT,
  group_name TEXT,
  rule_version TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE project_relations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES sports_projects(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('profile','content','course','competition','org')),
  entity_id TEXT NOT NULL,
  UNIQUE (project_id, entity_type, entity_id)
);

CREATE TABLE project_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES sports_projects(id),
  version INTEGER NOT NULL,
  change_summary TEXT NOT NULL,
  actor_account_id TEXT REFERENCES accounts(id),
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ============ 人员档案域 ============
CREATE TABLE person_profiles (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  kind TEXT NOT NULL CHECK (kind IN ('athlete','coach','mentor')),
  title TEXT,
  bio TEXT,
  region TEXT,
  achievements TEXT,
  career TEXT,
  mentor_info TEXT,
  verify_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verify_status IN ('verified','unverified','pending','appealing')),
  visibility TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE profile_project_links (
  profile_id TEXT NOT NULL REFERENCES person_profiles(id),
  project_id TEXT NOT NULL REFERENCES sports_projects(id),
  is_primary INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, project_id)
);

CREATE TABLE follows (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('profile','project','org','content')),
  target_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (account_id, target_type, target_id)
);

CREATE TABLE mentorships (
  id TEXT PRIMARY KEY,
  mentor_account_id TEXT NOT NULL REFERENCES accounts(id),
  mentee_account_id TEXT NOT NULL REFERENCES accounts(id),
  kind TEXT NOT NULL CHECK (kind IN ('student','coach')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  since TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE authorizations (
  id TEXT PRIMARY KEY,
  mentorship_id TEXT NOT NULL REFERENCES mentorships(id),
  grantor_account_id TEXT NOT NULL REFERENCES accounts(id),
  grantee_account_id TEXT NOT NULL REFERENCES accounts(id),
  scope_project_id TEXT REFERENCES sports_projects(id),
  scope_content TEXT,
  scope_region TEXT,
  term_start TEXT NOT NULL,
  term_end TEXT NOT NULL,
  allow_sub_grant INTEGER NOT NULL DEFAULT 0,
  parent_authorization_id TEXT REFERENCES authorizations(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','active','expired','revoked')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

-- ============ 教学训练域 ============
CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mentor_account_id TEXT NOT NULL REFERENCES accounts(id),
  org_id TEXT REFERENCES organizations(id),
  format TEXT NOT NULL CHECK (format IN ('offline','online')),
  audience TEXT,
  outline TEXT,
  sessions TEXT,
  region TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_review','published','paused','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE course_project_links (
  course_id TEXT NOT NULL REFERENCES courses(id),
  project_id TEXT NOT NULL REFERENCES sports_projects(id),
  PRIMARY KEY (course_id, project_id)
);

CREATE TABLE classes (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  name TEXT NOT NULL,
  schedule TEXT,
  capacity INTEGER,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE enrollments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  class_id TEXT REFERENCES classes(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled','completed')),
  decided_by TEXT,
  decided_at TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (course_id, account_id)
);

CREATE TABLE attendance (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id),
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  occurred_on TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','leave')),
  recorded_by TEXT REFERENCES accounts(id),
  created_at TEXT NOT NULL,
  UNIQUE (class_id, enrollment_id, occurred_on)
);

CREATE TABLE training_plans (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  mentor_account_id TEXT REFERENCES accounts(id),
  course_id TEXT REFERENCES courses(id),
  title TEXT NOT NULL,
  items TEXT,
  period TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE training_records (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES training_plans(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  content TEXT,
  metrics TEXT,
  occurred_on TEXT NOT NULL,
  recorded_by TEXT REFERENCES accounts(id),
  created_at TEXT NOT NULL
);

-- ============ 赛事域 ============
CREATE TABLE competitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  organizer_org_id TEXT REFERENCES organizations(id),
  date_start TEXT NOT NULL,
  date_end TEXT NOT NULL,
  location TEXT,
  intro TEXT,
  quota INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_review','published','registration_closed','in_progress','completed','cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE competition_project_links (
  competition_id TEXT NOT NULL REFERENCES competitions(id),
  project_id TEXT NOT NULL REFERENCES sports_projects(id),
  PRIMARY KEY (competition_id, project_id)
);

CREATE TABLE registrations (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  decided_by TEXT,
  decided_at TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (competition_id, account_id)
);

CREATE TABLE competition_schedules (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id),
  unit_name TEXT NOT NULL,
  phase TEXT,
  start_at TEXT NOT NULL,
  venue TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE results (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  unit_name TEXT NOT NULL,
  rank INTEGER,
  score TEXT,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'provisional' CHECK (status IN ('provisional','confirmed')),
  confirmed_by TEXT REFERENCES accounts(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE result_revisions (
  id TEXT PRIMARY KEY,
  result_id TEXT NOT NULL REFERENCES results(id),
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  reason TEXT NOT NULL,
  actor_account_id TEXT REFERENCES accounts(id),
  created_at TEXT NOT NULL
);

CREATE TABLE selections (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  target TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nominated' CHECK (status IN ('nominated','selected','dropped')),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

-- ============ 内容与榜单域 ============
CREATE TABLE contents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('video','article')),
  title TEXT NOT NULL,
  summary TEXT,
  author_account_id TEXT NOT NULL REFERENCES accounts(id),
  media_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_review','published','offline')),
  published_at TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  favs INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE content_project_links (
  content_id TEXT NOT NULL REFERENCES contents(id),
  project_id TEXT NOT NULL REFERENCES sports_projects(id),
  PRIMARY KEY (content_id, project_id)
);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES contents(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at TEXT NOT NULL
);

CREATE TABLE reactions (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES contents(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  kind TEXT NOT NULL CHECK (kind IN ('like','fav')),
  created_at TEXT NOT NULL,
  UNIQUE (content_id, account_id, kind)
);

CREATE TABLE ranking_definitions (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('athlete','mentor','project','course','event','org','city')),
  mode TEXT NOT NULL CHECK (mode IN ('overall','pro','popularity')),
  formula TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('week','month','total')),
  status TEXT NOT NULL DEFAULT 'active',
  updated_at TEXT NOT NULL
);

CREATE TABLE ranking_snapshots (
  id TEXT PRIMARY KEY,
  definition_id TEXT NOT NULL REFERENCES ranking_definitions(id),
  period_key TEXT NOT NULL,
  rows TEXT NOT NULL,
  computed_at TEXT NOT NULL
);

-- ============ 消息、设置与媒体域 ============
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  category TEXT NOT NULL CHECK (category IN ('system','interact','biz','mentorship')),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  biz_ref_type TEXT,
  biz_ref_id TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_notifications_account ON notifications(account_id, created_at DESC);

CREATE TABLE settings (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  scope TEXT NOT NULL CHECK (scope IN ('account','privacy','notify','org','device')),
  org_id TEXT,
  device_id TEXT,
  prefs TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE (account_id, scope, org_id, device_id)
);

CREATE TABLE media_files (
  id TEXT PRIMARY KEY,
  owner_account_id TEXT REFERENCES accounts(id),
  filename TEXT NOT NULL,
  mime TEXT,
  size INTEGER,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);
