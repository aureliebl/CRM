-- PostgreSQL migration (Phase 7)
-- Scope: per-account session invalidation support

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sessionVersion INTEGER DEFAULT 1;
