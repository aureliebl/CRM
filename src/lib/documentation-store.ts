import { Pool } from "pg";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getGroupIdForAccount } from "@/lib/security-store";
import type {
  DocumentationBlock,
  DocumentationFolderVisibility,
  DocumentationMedia,
  DocumentationNode,
  DocumentationTreeItem,
} from "@/lib/documentation-types";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required (runtime is PostgreSQL-only)");
}

const pgPool = new Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.PGSSL === "true"
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
});

let postgresReady: Promise<void> | null = null;
let documentationMediaReconciled = false;

const nowIso = () => new Date().toISOString();

export type DocumentationActorScope = {
  id: string;
  role: "admin" | "operator";
  groupId: string | null;
};

export type DocumentationNodeAccess = {
  node: DocumentationNode;
  canRead: boolean;
  canWrite: boolean;
};

type DocumentationNodeRow = {
  id: string;
  parentid: string | null;
  kind: "folder" | "page";
  title: string;
  subtitle: string | null;
  covermediaid: string | null;
  ispublic: number;
  ownerid: string;
  foldervisibility: DocumentationFolderVisibility;
  groupid: string | null;
  isprivate: number;
  contentjson: string;
  createdat: string;
  updatedat: string;
};

type DocumentationMediaRow = {
  id: string;
  nodeid: string;
  ownerid: string;
  filename: string;
  mimetype: string;
  sizebytes: number;
  storagepath: string;
  createdat: string;
  updatedat: string;
};

function extractMediaIdsFromBlocks(blocks: DocumentationBlock[]): Set<string> {
  const mediaIds = new Set<string>();
  for (const block of blocks) {
    if (block.type !== "image") continue;
    const mediaId = String(block.mediaId ?? "").trim();
    if (mediaId) mediaIds.add(mediaId);
  }
  return mediaIds;
}

async function listMediaRowsForNodeIds(nodeIds: string[]): Promise<DocumentationMediaRow[]> {
  if (nodeIds.length === 0) return [];
  const result = await pgPool.query(
    "SELECT * FROM documentation_media WHERE nodeId = ANY($1::text[])",
    [nodeIds]
  );
  return result.rows as DocumentationMediaRow[];
}

async function deleteMediaRowsAndFiles(rows: DocumentationMediaRow[]): Promise<void> {
  if (rows.length === 0) return;

  const ids = rows.map((row) => row.id);
  await pgPool.query("DELETE FROM documentation_media WHERE id = ANY($1::text[])", [ids]);

  for (const row of rows) {
    await fs.unlink(row.storagepath).catch(() => undefined);
  }
}

async function reconcileDocumentationMediaStorage(): Promise<void> {
  if (documentationMediaReconciled) return;

  const mediaResult = await pgPool.query("SELECT id, nodeId, storagePath FROM documentation_media");
  const mediaRows = mediaResult.rows as Array<{ id: string; nodeid: string; storagepath: string }>;

  const pagesResult = await pgPool.query("SELECT id, contentJson FROM documentation_nodes WHERE kind = 'page'");
  const pageRows = pagesResult.rows as Array<{ id: string; contentjson: string }>;

  const referencedMediaIds = new Set<string>();
  for (const page of pageRows) {
    const blocks = parseContentJson(page.contentjson ?? "[]");
    const mediaIds = extractMediaIdsFromBlocks(blocks);
    for (const mediaId of mediaIds) {
      referencedMediaIds.add(mediaId);
    }
  }

  const staleRows = mediaRows.filter((row) => !referencedMediaIds.has(String(row.id)));
  if (staleRows.length > 0) {
    await deleteMediaRowsAndFiles(
      staleRows.map((row) => ({
        id: String(row.id),
        nodeid: String(row.nodeid),
        ownerid: "",
        filename: "",
        mimetype: "",
        sizebytes: 0,
        storagepath: String(row.storagepath),
        createdat: "",
        updatedat: "",
      }))
    );
  }

  const uploadsDir = path.join(process.cwd(), "data", "uploads", "documentation");
  const dbPaths = new Set(mediaRows.map((row) => String(row.storagepath)));
  const files = await fs.readdir(uploadsDir).catch(() => [] as string[]);

  for (const file of files) {
    const absolutePath = path.join(uploadsDir, file);
    if (!dbPaths.has(absolutePath)) {
      await fs.unlink(absolutePath).catch(() => undefined);
    }
  }

  documentationMediaReconciled = true;
}

function parseContentJson(raw: string): DocumentationBlock[] {
  try {
    const parsed = JSON.parse(raw) as DocumentationBlock[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapNodeRow(row: DocumentationNodeRow): DocumentationNode {
  return {
    id: row.id,
    parentId: row.parentid,
    kind: row.kind,
    title: row.title,
    subtitle: row.subtitle ?? "",
    coverMediaId: row.covermediaid,
    isPublic: Number(row.ispublic ?? 0) === 1,
    ownerId: row.ownerid,
    folderVisibility: row.foldervisibility,
    groupId: row.groupid,
    isPrivate: Number(row.isprivate ?? 0) === 1,
    content: parseContentJson(row.contentjson ?? "[]"),
    createdAt: row.createdat,
    updatedAt: row.updatedat,
  };
}

function mapTreeItem(node: DocumentationNode): DocumentationTreeItem {
  return {
    id: node.id,
    parentId: node.parentId,
    kind: node.kind,
    title: node.title,
    subtitle: node.subtitle,
    coverMediaId: node.coverMediaId,
    isPublic: node.isPublic,
    isPrivate: node.isPrivate,
    folderVisibility: node.folderVisibility,
    groupId: node.groupId,
    ownerId: node.ownerId,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  };
}

async function ensurePostgresSchema() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS documentation_nodes (
      id TEXT PRIMARY KEY,
      parentId TEXT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      coverMediaId TEXT,
      isPublic INTEGER NOT NULL DEFAULT 0,
      ownerId TEXT NOT NULL,
      folderVisibility TEXT NOT NULL DEFAULT 'public',
      groupId TEXT,
      isPrivate INTEGER NOT NULL DEFAULT 0,
      contentJson TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_documentation_nodes_parent
      ON documentation_nodes(parentId)
  `);

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_documentation_nodes_owner
      ON documentation_nodes(ownerId)
  `);

  await pgPool.query("ALTER TABLE documentation_nodes ADD COLUMN IF NOT EXISTS subtitle TEXT NOT NULL DEFAULT ''");
  await pgPool.query("ALTER TABLE documentation_nodes ADD COLUMN IF NOT EXISTS coverMediaId TEXT");
  await pgPool.query("ALTER TABLE documentation_nodes ADD COLUMN IF NOT EXISTS isPublic INTEGER NOT NULL DEFAULT 0");

  await pgPool.query(`
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
    )
  `);

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_documentation_media_node
      ON documentation_media(nodeId)
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS documentation_crdt_docs (
      nodeId TEXT PRIMARY KEY,
      ydoc BYTEA NOT NULL,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS documentation_crdt_updates (
      id BIGSERIAL PRIMARY KEY,
      nodeId TEXT NOT NULL,
      actorId TEXT,
      update BYTEA NOT NULL,
      createdAt TEXT
    )
  `);

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_documentation_crdt_updates_node
      ON documentation_crdt_updates(nodeId)
  `);
}

async function ensurePostgresReady() {
  if (!postgresReady) {
    postgresReady = ensurePostgresSchema();
  }
  await postgresReady;
  await reconcileDocumentationMediaStorage();
}

async function getAllDocumentationNodes(): Promise<DocumentationNode[]> {
  await ensurePostgresReady();
  const result = await pgPool.query("SELECT * FROM documentation_nodes ORDER BY createdAt ASC");
  return result.rows.map((row) => mapNodeRow(row as DocumentationNodeRow));
}

function buildNodeMap(nodes: DocumentationNode[]): Map<string, DocumentationNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function resolveFolderShareScope(node: DocumentationNode, map: Map<string, DocumentationNode>): {
  folderVisibility: DocumentationFolderVisibility;
  groupId: string | null;
} {
  let current: DocumentationNode | undefined = node;

  while (current) {
    if (current.kind === "folder") {
      return {
        folderVisibility: current.folderVisibility,
        groupId: current.groupId,
      };
    }

    if (!current.parentId) break;
    current = map.get(current.parentId);
  }

  return {
    folderVisibility: "public",
    groupId: null,
  };
}

function canReadNode(actor: DocumentationActorScope, node: DocumentationNode, map: Map<string, DocumentationNode>) {
  if (node.isPublic) return true;

  if (node.isPrivate) {
    return node.ownerId === actor.id;
  }

  const scope = resolveFolderShareScope(node, map);
  if (scope.folderVisibility === "public") return true;
  if (actor.role === "admin") return true;
  if (!scope.groupId || !actor.groupId) return false;
  return scope.groupId === actor.groupId;
}

function canWriteNode(actor: DocumentationActorScope, node: DocumentationNode, map: Map<string, DocumentationNode>) {
  if (node.isPrivate) {
    return node.ownerId === actor.id;
  }
  return canReadNode(actor, node, map);
}

async function getNodeById(nodeId: string): Promise<DocumentationNode | null> {
  await ensurePostgresReady();
  const result = await pgPool.query("SELECT * FROM documentation_nodes WHERE id = $1", [nodeId]);
  const row = result.rows[0] as DocumentationNodeRow | undefined;
  return row ? mapNodeRow(row) : null;
}

async function getActorScope(input: { id: string; role: "admin" | "operator" }): Promise<DocumentationActorScope> {
  const groupId = await getGroupIdForAccount(input.id);
  return {
    id: input.id,
    role: input.role,
    groupId,
  };
}

export async function resolveDocumentationActorScope(input: {
  id: string;
  role: "admin" | "operator";
}) {
  return getActorScope(input);
}

export async function getAccessibleDocumentationTree(actor: DocumentationActorScope): Promise<DocumentationTreeItem[]> {
  const nodes = await getAllDocumentationNodes();
  const map = buildNodeMap(nodes);

  const accessible = nodes.filter((node) => canReadNode(actor, node, map));
  return accessible.map(mapTreeItem);
}

export async function listAccessibleDocumentationPages(actor: DocumentationActorScope): Promise<DocumentationTreeItem[]> {
  const tree = await getAccessibleDocumentationTree(actor);
  return tree.filter((node) => node.kind === "page");
}

export async function getDocumentationNodeForActor(
  actor: DocumentationActorScope,
  nodeId: string
): Promise<DocumentationNode | null> {
  const nodes = await getAllDocumentationNodes();
  const map = buildNodeMap(nodes);
  const node = map.get(nodeId);
  if (!node) return null;
  if (!canReadNode(actor, node, map)) return null;
  return node;
}

export async function getDocumentationNodeAccessForActor(
  actor: DocumentationActorScope,
  nodeId: string
): Promise<DocumentationNodeAccess | null> {
  const nodes = await getAllDocumentationNodes();
  const map = buildNodeMap(nodes);
  const node = map.get(nodeId);
  if (!node) return null;

  return {
    node,
    canRead: canReadNode(actor, node, map),
    canWrite: canWriteNode(actor, node, map),
  };
}

export async function canActorAccessDocumentationNode(
  actor: DocumentationActorScope,
  nodeId: string,
  mode: "read" | "write"
): Promise<boolean> {
  const access = await getDocumentationNodeAccessForActor(actor, nodeId);
  if (!access) return false;
  return mode === "read" ? access.canRead : access.canWrite;
}

export async function createDocumentationNode(
  actor: DocumentationActorScope,
  input: {
    parentId: string | null;
    kind: "folder" | "page";
    title: string;
    subtitle?: string;
    coverMediaId?: string | null;
    isPublic?: boolean;
    folderVisibility?: DocumentationFolderVisibility;
    groupId?: string | null;
    isPrivate?: boolean;
  }
): Promise<DocumentationNode | null> {
  await ensurePostgresReady();

  const title = input.title.trim();
  if (!title) return null;

  if (input.parentId) {
    const nodes = await getAllDocumentationNodes();
    const map = buildNodeMap(nodes);
    const parentNode = map.get(input.parentId);
    if (!parentNode || parentNode.kind !== "folder") return null;
    if (!canWriteNode(actor, parentNode, map)) return null;
  }

  const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = nowIso();
  const folderVisibility = input.folderVisibility ?? "public";
  const groupId = folderVisibility === "group" ? (input.groupId ?? actor.groupId) : null;
  const isPrivate = input.kind === "page" ? Boolean(input.isPrivate) : false;
  const subtitle = String(input.subtitle ?? "").trim();
  const coverMediaId = input.kind === "page" ? input.coverMediaId ?? null : null;
  const isPublic = input.kind === "page" ? Boolean(input.isPublic) : false;

  await pgPool.query(
    `INSERT INTO documentation_nodes
      (id, parentId, kind, title, subtitle, coverMediaId, isPublic, ownerId, folderVisibility, groupId, isPrivate, contentJson, createdAt, updatedAt)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      id,
      input.parentId,
      input.kind,
      title,
      subtitle,
      coverMediaId,
      isPublic ? 1 : 0,
      actor.id,
      folderVisibility,
      groupId,
      isPrivate ? 1 : 0,
      input.kind === "page" ? "[]" : "[]",
      now,
      now,
    ]
  );

  return getNodeById(id);
}

export async function updateDocumentationNode(
  actor: DocumentationActorScope,
  nodeId: string,
  patch: {
    title?: string;
    subtitle?: string;
    coverMediaId?: string | null;
    isPublic?: boolean;
    isPrivate?: boolean;
    content?: DocumentationBlock[];
    folderVisibility?: DocumentationFolderVisibility;
    groupId?: string | null;
  }
): Promise<DocumentationNode | null> {
  await ensurePostgresReady();

  const nodes = await getAllDocumentationNodes();
  const map = buildNodeMap(nodes);
  const node = map.get(nodeId);
  if (!node) return null;
  if (!canWriteNode(actor, node, map)) return null;

  const nextTitle = patch.title !== undefined ? patch.title.trim() : node.title;
  if (!nextTitle) return null;
  const nextSubtitle = patch.subtitle !== undefined ? patch.subtitle.trim() : node.subtitle;
  const nextCoverMediaId = node.kind === "page" ? (patch.coverMediaId !== undefined ? patch.coverMediaId : node.coverMediaId) : null;
  const nextIsPublic = node.kind === "page" ? (patch.isPublic !== undefined ? Boolean(patch.isPublic) : node.isPublic) : false;

  const nextIsPrivate =
    node.kind === "page" && patch.isPrivate !== undefined
      ? Boolean(patch.isPrivate)
      : node.isPrivate;

  const nextBlocks = patch.content !== undefined ? patch.content : node.content;
  const nextContent = JSON.stringify(nextBlocks);

  let nextFolderVisibility = node.folderVisibility;
  let nextGroupId = node.groupId;

  if (node.kind === "folder" && patch.folderVisibility) {
    nextFolderVisibility = patch.folderVisibility;
    nextGroupId = patch.folderVisibility === "group" ? (patch.groupId ?? actor.groupId) : null;
  }

  const now = nowIso();
  await pgPool.query(
    `UPDATE documentation_nodes
     SET title = $1,
         subtitle = $2,
         coverMediaId = $3,
         isPublic = $4,
         isPrivate = $5,
         contentJson = $6,
         folderVisibility = $7,
         groupId = $8,
         updatedAt = $9
     WHERE id = $10`,
    [
      nextTitle,
      nextSubtitle,
      nextCoverMediaId,
      nextIsPublic ? 1 : 0,
      nextIsPrivate ? 1 : 0,
      nextContent,
      nextFolderVisibility,
      nextGroupId,
      now,
      nodeId,
    ]
  );

  if (node.kind === "page" && patch.content !== undefined) {
    const referencedMediaIds = extractMediaIdsFromBlocks(nextBlocks);
    const nodeMediaRows = await listMediaRowsForNodeIds([nodeId]);
    const orphanRows = nodeMediaRows.filter((row) => !referencedMediaIds.has(row.id));
    await deleteMediaRowsAndFiles(orphanRows);
  }

  return getNodeById(nodeId);
}

function collectDescendantIds(rootId: string, nodes: DocumentationNode[]): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const existing = childrenByParent.get(node.parentId) ?? [];
    existing.push(node.id);
    childrenByParent.set(node.parentId, existing);
  }

  const visited = new Set<string>();
  const stack = [rootId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const children = childrenByParent.get(current) ?? [];
    for (const childId of children) {
      if (!visited.has(childId)) {
        stack.push(childId);
      }
    }
  }

  return visited;
}

export async function moveDocumentationNode(
  actor: DocumentationActorScope,
  nodeId: string,
  nextParentId: string | null
): Promise<DocumentationNode | null> {
  await ensurePostgresReady();

  const nodes = await getAllDocumentationNodes();
  const map = buildNodeMap(nodes);
  const node = map.get(nodeId);
  if (!node) return null;
  if (!canWriteNode(actor, node, map)) return null;

  if (nextParentId === nodeId) return null;

  if (nextParentId) {
    const parent = map.get(nextParentId);
    if (!parent || parent.kind !== "folder") return null;
    if (!canWriteNode(actor, parent, map)) return null;

    const descendants = collectDescendantIds(nodeId, nodes);
    if (descendants.has(nextParentId)) return null;
  }

  await pgPool.query("UPDATE documentation_nodes SET parentId = $1, updatedAt = $2 WHERE id = $3", [
    nextParentId,
    nowIso(),
    nodeId,
  ]);

  return getNodeById(nodeId);
}

export async function deleteDocumentationNode(actor: DocumentationActorScope, nodeId: string): Promise<boolean> {
  await ensurePostgresReady();

  const nodes = await getAllDocumentationNodes();
  const map = buildNodeMap(nodes);
  const node = map.get(nodeId);
  if (!node) return false;
  if (!canWriteNode(actor, node, map)) return false;

  const descendants = collectDescendantIds(nodeId, nodes);
  const ids = Array.from(descendants);
  if (ids.length === 0) return false;

  const mediaRows = await listMediaRowsForNodeIds(ids);
  await deleteMediaRowsAndFiles(mediaRows);
  await pgPool.query("DELETE FROM documentation_nodes WHERE id = ANY($1::text[])", [ids]);
  return true;
}

export async function createDocumentationMediaRecord(
  actor: DocumentationActorScope,
  input: {
    nodeId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
  }
): Promise<DocumentationMedia | null> {
  await ensurePostgresReady();

  const nodes = await getAllDocumentationNodes();
  const map = buildNodeMap(nodes);
  const node = map.get(input.nodeId);
  if (!node || node.kind !== "page") return null;
  if (!canWriteNode(actor, node, map)) return null;

  const id = `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = nowIso();

  await pgPool.query(
    `INSERT INTO documentation_media
      (id, nodeId, ownerId, fileName, mimeType, sizeBytes, storagePath, createdAt, updatedAt)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      input.nodeId,
      actor.id,
      input.fileName,
      input.mimeType,
      input.sizeBytes,
      input.storagePath,
      now,
      now,
    ]
  );

  return {
    id,
    nodeId: input.nodeId,
    ownerId: actor.id,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    storagePath: input.storagePath,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getDocumentationMediaForActor(
  actor: DocumentationActorScope,
  mediaId: string
): Promise<DocumentationMedia | null> {
  await ensurePostgresReady();

  const mediaResult = await pgPool.query("SELECT * FROM documentation_media WHERE id = $1", [mediaId]);
  const mediaRow = mediaResult.rows[0] as DocumentationMediaRow | undefined;

  if (!mediaRow) return null;

  const node = await getDocumentationNodeForActor(actor, mediaRow.nodeid);
  if (!node) return null;

  return {
    id: mediaRow.id,
    nodeId: mediaRow.nodeid,
    ownerId: mediaRow.ownerid,
    fileName: mediaRow.filename,
    mimeType: mediaRow.mimetype,
    sizeBytes: Number(mediaRow.sizebytes ?? 0),
    storagePath: mediaRow.storagepath,
    createdAt: mediaRow.createdat,
    updatedAt: mediaRow.updatedat,
  };
}
