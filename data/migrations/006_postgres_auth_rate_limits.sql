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
