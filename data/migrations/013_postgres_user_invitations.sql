-- Migration 013: user_invitations table + isAdmin column on user_groups

ALTER TABLE user_groups ADD COLUMN IF NOT EXISTS isAdmin INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS user_invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  groupId TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expiresAt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  invitedBy TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  acceptedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(status);
