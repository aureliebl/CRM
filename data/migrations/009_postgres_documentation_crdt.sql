CREATE TABLE IF NOT EXISTS documentation_crdt_docs (
  nodeId TEXT PRIMARY KEY,
  ydoc BYTEA NOT NULL,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS documentation_crdt_updates (
  id BIGSERIAL PRIMARY KEY,
  nodeId TEXT NOT NULL,
  actorId TEXT,
  update BYTEA NOT NULL,
  createdAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_documentation_crdt_updates_node
  ON documentation_crdt_updates(nodeId);
