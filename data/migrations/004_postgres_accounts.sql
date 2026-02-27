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
  profileImage TEXT,
  locale TEXT DEFAULT 'fr',
  totpEnabled INTEGER DEFAULT 0,
  totpSecret TEXT,
  extras TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS isActive INTEGER DEFAULT 1;

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
