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
