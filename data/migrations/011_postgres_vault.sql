-- PostgreSQL migration (Phase 11)
-- Scope: Vault — encrypted password manager with TOTP support

CREATE TABLE IF NOT EXISTS vault_entries (
  id TEXT PRIMARY KEY,
  service_name TEXT NOT NULL,
  service_url TEXT,
  encrypted_login TEXT NOT NULL,
  login_iv TEXT NOT NULL,
  login_auth_tag TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  password_iv TEXT NOT NULL,
  password_auth_tag TEXT NOT NULL,
  encrypted_notes TEXT,
  notes_iv TEXT,
  notes_auth_tag TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS vault_totp (
  id TEXT PRIMARY KEY,
  vault_entry_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'TOTP principal',
  encrypted_secret TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'SHA1',
  digits INTEGER NOT NULL DEFAULT 6,
  period INTEGER NOT NULL DEFAULT 30,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_vault_totp_entry
  ON vault_totp(vault_entry_id);

CREATE TABLE IF NOT EXISTS vault_entry_groups (
  vault_entry_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  PRIMARY KEY (vault_entry_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_vault_entry_groups_group
  ON vault_entry_groups(group_id);

CREATE TABLE IF NOT EXISTS vault_backup_codes (
  id TEXT PRIMARY KEY,
  vault_totp_id TEXT NOT NULL,
  encrypted_code TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_vault_backup_codes_totp
  ON vault_backup_codes(vault_totp_id);
