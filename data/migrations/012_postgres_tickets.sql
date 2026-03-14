-- PostgreSQL migration (Phase 12)
-- Scope: Tickets kanban board with external JSON ingestion

CREATE TABLE IF NOT EXISTS ticket_boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  columns TEXT NOT NULL DEFAULT '[]',
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ticket_cards (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  column_key TEXT NOT NULL DEFAULT 'nouveau',
  position INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  variables TEXT DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'manual',
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ticket_cards_board
  ON ticket_cards(board_id);

CREATE INDEX IF NOT EXISTS idx_ticket_cards_column
  ON ticket_cards(board_id, column_key, position);

CREATE TABLE IF NOT EXISTS ticket_api_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  board_id TEXT NOT NULL,
  created_by TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT
);
