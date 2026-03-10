ALTER TABLE documentation_nodes
  ADD COLUMN IF NOT EXISTS subtitle TEXT NOT NULL DEFAULT '';

ALTER TABLE documentation_nodes
  ADD COLUMN IF NOT EXISTS coverMediaId TEXT;

ALTER TABLE documentation_nodes
  ADD COLUMN IF NOT EXISTS isPublic INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS documentation_node_group_shares (
  nodeId TEXT NOT NULL,
  groupId TEXT NOT NULL,
  createdAt TEXT,
  PRIMARY KEY (nodeId, groupId)
);

CREATE INDEX IF NOT EXISTS idx_doc_node_group_shares_group
  ON documentation_node_group_shares(groupId);

CREATE TABLE IF NOT EXISTS documentation_node_user_shares (
  nodeId TEXT NOT NULL,
  accountId TEXT NOT NULL,
  createdAt TEXT,
  PRIMARY KEY (nodeId, accountId)
);

CREATE INDEX IF NOT EXISTS idx_doc_node_user_shares_account
  ON documentation_node_user_shares(accountId);
