-- PostgreSQL migration (Phase 1)
-- Scope: connectors storage only. BigQuery runtime remains unchanged.

CREATE TABLE IF NOT EXISTS data_connectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  configEncrypted TEXT NOT NULL,
  createdBy TEXT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_data_connectors_provider
ON data_connectors(provider);

CREATE INDEX IF NOT EXISTS idx_data_connectors_enabled
ON data_connectors(enabled);
-- PostgreSQL migration (Phase 2)
-- Scope: dynamic tabs storage

CREATE TABLE IF NOT EXISTS app_tabs (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  icon TEXT,
  enabled INTEGER DEFAULT 1,
  isSystem INTEGER DEFAULT 0,
  createdBy TEXT NOT NULL,
  configJson TEXT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS app_tab_group_visibility (
  tabId TEXT NOT NULL,
  groupId TEXT NOT NULL,
  createdAt TEXT,
  PRIMARY KEY (tabId, groupId)
);

CREATE INDEX IF NOT EXISTS idx_app_tabs_slug
ON app_tabs(slug);

CREATE INDEX IF NOT EXISTS idx_app_tabs_enabled
ON app_tabs(enabled);

CREATE INDEX IF NOT EXISTS idx_app_tab_group_visibility_group
ON app_tab_group_visibility(groupId);
-- PostgreSQL migration (Phase 3)
-- Scope: security and IAM storage

CREATE TABLE IF NOT EXISTS user_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  isDefault INTEGER DEFAULT 0,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS account_group_memberships (
  accountId TEXT PRIMARY KEY,
  groupId TEXT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS security_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS ip_allowlist_entries (
  id TEXT PRIMARY KEY,
  ipOrCidr TEXT NOT NULL,
  label TEXT,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_groups_default
ON user_groups(isDefault);

CREATE INDEX IF NOT EXISTS idx_memberships_group
ON account_group_memberships(groupId);

CREATE INDEX IF NOT EXISTS idx_ip_allowlist_active
ON ip_allowlist_entries(isActive);
-- PostgreSQL migration (Phase 4)
-- Scope: accounts and audit logs storage

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT,
  firstName TEXT,
  lastName TEXT,
  fullName TEXT,
  role TEXT,
  isActive INTEGER DEFAULT 1,
  sessionVersion INTEGER DEFAULT 1,
  profileImage TEXT,
  locale TEXT DEFAULT 'fr',
  totpEnabled INTEGER DEFAULT 0,
  totpSecret TEXT,
  extras TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS isActive INTEGER DEFAULT 1;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sessionVersion INTEGER DEFAULT 1;

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  accountId TEXT,
  type TEXT,
  message TEXT,
  timestamp TEXT
);

CREATE TABLE IF NOT EXISTS account_password_reset_tokens (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  tokenHash TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  createdBy TEXT,
  usedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_accounts_role
ON accounts(role);

CREATE INDEX IF NOT EXISTS idx_accounts_fullname
ON accounts(fullName);

CREATE INDEX IF NOT EXISTS idx_logs_account
ON logs(accountId);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_hash
ON account_password_reset_tokens(tokenHash);
-- PostgreSQL migration (Phase 5)
-- Scope: dashboard graph storage

CREATE TABLE IF NOT EXISTS dashboard_graphs (
  id TEXT PRIMARY KEY,
  ownerUserId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  size TEXT NOT NULL DEFAULT 'M',
  layoutOrder INTEGER NOT NULL DEFAULT 0,
  isShared INTEGER NOT NULL DEFAULT 0,
  sharedFromGraphId TEXT,
  config TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dashboard_graphs_owner
ON dashboard_graphs(ownerUserId);

CREATE INDEX IF NOT EXISTS idx_dashboard_graphs_shared
ON dashboard_graphs(isShared);
-- PostgreSQL migration (Phase 6)
-- Scope: auth rate limiting

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  scopeHash TEXT NOT NULL,
  count INTEGER NOT NULL,
  windowStart TEXT NOT NULL,
  blockedUntil TEXT,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_action
ON auth_rate_limits(action);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_updated_at
ON auth_rate_limits(updatedAt);
-- PostgreSQL migration (Phase 7)
-- Scope: per-account session invalidation support

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sessionVersion INTEGER DEFAULT 1;
CREATE TABLE IF NOT EXISTS documentation_nodes (
  id TEXT PRIMARY KEY,
  parentId TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  ownerId TEXT NOT NULL,
  folderVisibility TEXT NOT NULL DEFAULT 'public',
  groupId TEXT,
  isPrivate INTEGER NOT NULL DEFAULT 0,
  contentJson TEXT NOT NULL DEFAULT '[]',
  createdAt TEXT,
  updatedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_documentation_nodes_parent
  ON documentation_nodes(parentId);

CREATE INDEX IF NOT EXISTS idx_documentation_nodes_owner
  ON documentation_nodes(ownerId);

CREATE TABLE IF NOT EXISTS documentation_media (
  id TEXT PRIMARY KEY,
  nodeId TEXT NOT NULL,
  ownerId TEXT NOT NULL,
  fileName TEXT NOT NULL,
  mimeType TEXT NOT NULL,
  sizeBytes INTEGER NOT NULL,
  storagePath TEXT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_documentation_media_node
  ON documentation_media(nodeId);
CREATE TABLE IF NOT EXISTS documentation_crdt_docs (
  nodeId TEXT PRIMARY KEY,
  ydoc BYTEA NOT NULL,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS documentation_crdt_updates (
  id BIGSERIAL PRIMARY KEY,
  nodeId TEXT NOT NULL,
  actorId TEXT,
  update BYTEA NOT NULL,
  createdAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_documentation_crdt_updates_node
  ON documentation_crdt_updates(nodeId);
