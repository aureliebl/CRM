CREATE TABLE IF NOT EXISTS documentation_nodes (
  id TEXT PRIMARY KEY,
  parentId TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  ownerId TEXT NOT NULL,
  folderVisibility TEXT NOT NULL DEFAULT 'public',
  groupId TEXT,
  isPrivate INTEGER NOT NULL DEFAULT 0,
  contentJson TEXT NOT NULL DEFAULT '[]',
  createdAt TEXT,
  updatedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_documentation_nodes_parent
  ON documentation_nodes(parentId);

CREATE INDEX IF NOT EXISTS idx_documentation_nodes_owner
  ON documentation_nodes(ownerId);

CREATE TABLE IF NOT EXISTS documentation_media (
  id TEXT PRIMARY KEY,
  nodeId TEXT NOT NULL,
  ownerId TEXT NOT NULL,
  fileName TEXT NOT NULL,
  mimeType TEXT NOT NULL,
  sizeBytes INTEGER NOT NULL,
  storagePath TEXT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_documentation_media_node
  ON documentation_media(nodeId);
