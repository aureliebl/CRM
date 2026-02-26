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
