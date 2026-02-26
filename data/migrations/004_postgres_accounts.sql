-- PostgreSQL migration (Phase 4)
-- Scope: accounts and audit logs storage

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT,
  firstName TEXT,
  lastName TEXT,
  fullName TEXT,
  role TEXT,
  profileImage TEXT,
  locale TEXT DEFAULT 'fr',
  totpEnabled INTEGER DEFAULT 0,
  totpSecret TEXT,
  extras TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  accountId TEXT,
  type TEXT,
  message TEXT,
  timestamp TEXT
);

CREATE INDEX IF NOT EXISTS idx_accounts_role
ON accounts(role);

CREATE INDEX IF NOT EXISTS idx_accounts_fullname
ON accounts(fullName);

CREATE INDEX IF NOT EXISTS idx_logs_account
ON logs(accountId);
