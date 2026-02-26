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
