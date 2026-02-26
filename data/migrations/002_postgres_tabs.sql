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
