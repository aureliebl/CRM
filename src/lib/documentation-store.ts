import { promises as fs } from "node:fs";
import path from "node:path";
import { getGroupIdForAccount } from "@/lib/security-store";
import { getSharedPgPool } from "@/lib/pg-pool";
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

const pgPoolMax = Math.max(1, Number(process.env.PGPOOL_MAX_CONNECTIONS || 1));
const pgPoolMin = Math.max(0, Number(process.env.PGPOOL_MIN_CONNECTIONS || 0));
const pgConnectionTimeoutMs = Math.max(
  1000,
  Number(process.env.PG_CONNECTION_TIMEOUT_MS || 15000)
);
const pgIdleTimeoutMs = Math.max(1000, Number(process.env.PG_IDLE_TIMEOUT_MS || 10000));

const pgPool = getSharedPgPool({
  connectionString: databaseUrl,
  max: pgPoolMax,
  min: pgPoolMin,
  connectionTimeoutMillis: pgConnectionTimeoutMs,
  idleTimeoutMillis: pgIdleTimeoutMs,
  ssl:
    process.env.PGSSL === "true"
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
});

let postgresReady: Promise<void> | null = null;
let documentationMediaReconciled = false;
let documentationMediaReconcilePromise: Promise<void> | null = null;

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

export class DocumentationCreateNodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentationCreateNodeError";
  }
}

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
  contentbytes: Buffer | null;
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
    const storagePath = String(row.storagepath ?? "").trim();
    if (!storagePath || !path.isAbsolute(storagePath)) continue;
    await fs.unlink(storagePath).catch(() => undefined);
  }
}

async function reconcileDocumentationMediaStorage(): Promise<void> {
  if (documentationMediaReconciled) return;

  const mediaResult = await pgPool.query("SELECT id, nodeId, storagePath, contentBytes FROM documentation_media");
  const mediaRows = mediaResult.rows as Array<{
    id: string;
    nodeid: string;
    storagepath: string;
    contentbytes?: Buffer | null;
  }>;

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
        contentbytes: row.contentbytes ?? null,
        createdat: "",
        updatedat: "",
      }))
    );
  }

  const uploadsDir = path.join(process.cwd(), "data", "uploads", "documentation");
  const dbPaths = new Set(
    mediaRows
      .filter((row) => !row.contentbytes)
      .map((row) => String(row.storagepath))
      .filter((value) => Boolean(value) && path.isAbsolute(value))
  );
  const files = await fs.readdir(uploadsDir).catch(() => [] as string[]);

  for (const file of files) {
    const absolutePath = path.join(uploadsDir, file);
    if (!dbPaths.has(absolutePath)) {
      await fs.unlink(absolutePath).catch(() => undefined);
    }
  }

  documentationMediaReconciled = true;
}

function startDocumentationMediaReconciliation() {
  if (documentationMediaReconciled || documentationMediaReconcilePromise) return;

  documentationMediaReconcilePromise = reconcileDocumentationMediaStorage()
    .catch((error) => {
      console.warn("[documentation-store] media reconciliation skipped", error);
    })
    .finally(() => {
      documentationMediaReconcilePromise = null;
    });
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
    sharedGroupIds: [],
    sharedUserIds: [],
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
    sharedGroupIds: node.sharedGroupIds,
    sharedUserIds: node.sharedUserIds,
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
      contentBytes BYTEA,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  await pgPool.query("ALTER TABLE documentation_media ADD COLUMN IF NOT EXISTS contentBytes BYTEA");

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

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS documentation_node_group_shares (
      nodeId TEXT NOT NULL,
      groupId TEXT NOT NULL,
      createdAt TEXT,
      PRIMARY KEY (nodeId, groupId)
    )
  `);

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_doc_node_group_shares_group
      ON documentation_node_group_shares(groupId)
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS documentation_node_user_shares (
      nodeId TEXT NOT NULL,
      accountId TEXT NOT NULL,
      createdAt TEXT,
      PRIMARY KEY (nodeId, accountId)
    )
  `);

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_doc_node_user_shares_account
      ON documentation_node_user_shares(accountId)
  `);
}

async function ensurePostgresReady() {
  if (!postgresReady) {
    postgresReady = ensurePostgresSchema();
  }
  await postgresReady;
  startDocumentationMediaReconciliation();
}

async function getAllDocumentationNodes(): Promise<DocumentationNode[]> {
  await ensurePostgresReady();
  const result = await pgPool.query("SELECT * FROM documentation_nodes ORDER BY createdAt ASC");
  const nodes = result.rows.map((row) => mapNodeRow(row as DocumentationNodeRow));
  if (nodes.length === 0) return nodes;

  const nodeIds = nodes.map((node) => node.id);
  const [groupSharesResult, userSharesResult] = await Promise.all([
    pgPool.query(
      "SELECT nodeId, groupId FROM documentation_node_group_shares WHERE nodeId = ANY($1::text[])",
      [nodeIds]
    ),
    pgPool.query(
      "SELECT nodeId, accountId FROM documentation_node_user_shares WHERE nodeId = ANY($1::text[])",
      [nodeIds]
    ),
  ]);

  const groupByNode = new Map<string, string[]>();
  for (const row of groupSharesResult.rows as Array<{ nodeid?: string; nodeId?: string; groupid?: string; groupId?: string }>) {
    const nodeId = String(row.nodeid ?? row.nodeId ?? "");
    const groupId = String(row.groupid ?? row.groupId ?? "");
    if (!nodeId || !groupId) continue;
    const values = groupByNode.get(nodeId) ?? [];
    values.push(groupId);
    groupByNode.set(nodeId, values);
  }

  const usersByNode = new Map<string, string[]>();
  for (const row of userSharesResult.rows as Array<{ nodeid?: string; nodeId?: string; accountid?: string; accountId?: string }>) {
    const nodeId = String(row.nodeid ?? row.nodeId ?? "");
    const accountId = String(row.accountid ?? row.accountId ?? "");
    if (!nodeId || !accountId) continue;
    const values = usersByNode.get(nodeId) ?? [];
    values.push(accountId);
    usersByNode.set(nodeId, values);
  }

  return nodes.map((node) => ({
    ...node,
    sharedGroupIds: Array.from(new Set(groupByNode.get(node.id) ?? [])),
    sharedUserIds: Array.from(new Set(usersByNode.get(node.id) ?? [])),
  }));
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

function getNodeAncestry(node: DocumentationNode, map: Map<string, DocumentationNode>): DocumentationNode[] {
  const ancestry: DocumentationNode[] = [];
  let current: DocumentationNode | undefined = node;

  while (current) {
    ancestry.push(current);
    if (!current.parentId) break;
    current = map.get(current.parentId);
  }

  return ancestry;
}

function canReadNode(actor: DocumentationActorScope, node: DocumentationNode, map: Map<string, DocumentationNode>) {
  if (actor.role === "admin") return true;
  if (node.ownerId === actor.id) return true;

  const ancestry = getNodeAncestry(node, map);
  const hasUserShare = ancestry.some((item) => item.sharedUserIds.includes(actor.id));
  const hasGroupShare = actor.groupId
    ? ancestry.some((item) => item.sharedGroupIds.includes(actor.groupId as string))
    : false;

  if (node.isPrivate) {
    return hasUserShare || hasGroupShare;
  }

  if (ancestry.some((item) => item.isPublic)) {
    return true;
  }

  if (hasUserShare || hasGroupShare) {
    return true;
  }

  const scope = resolveFolderShareScope(node, map);
  if (scope.folderVisibility === "public") return true;
  if (!scope.groupId || !actor.groupId) return false;
  return scope.groupId === actor.groupId;
}

function canWriteNode(actor: DocumentationActorScope, node: DocumentationNode, map: Map<string, DocumentationNode>) {
  if (actor.role === "admin") return true;
  if (node.ownerId === actor.id) return true;
  return canReadNode(actor, node, map);
}

async function getNodeById(nodeId: string): Promise<DocumentationNode | null> {
  const nodes = await getAllDocumentationNodes();
  return nodes.find((node) => node.id === nodeId) ?? null;
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
  await ensureActorPrivateRoot(actor);
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
    sharedGroupIds?: string[];
    sharedUserIds?: string[];
    folderVisibility?: DocumentationFolderVisibility;
    groupId?: string | null;
    isPrivate?: boolean;
  }
): Promise<DocumentationNode> {
  await ensurePostgresReady();

  const title = input.title.trim();
  if (!title) {
    throw new DocumentationCreateNodeError("Title is required");
  }

  if (input.parentId) {
    const nodes = await getAllDocumentationNodes();
    const map = buildNodeMap(nodes);
    const parentNode = map.get(input.parentId);
    if (!parentNode) {
      throw new DocumentationCreateNodeError("Parent not found");
    }
    if (parentNode.kind !== "folder" && parentNode.kind !== "page") {
      throw new DocumentationCreateNodeError("Invalid parent kind");
    }
    if (!canWriteNode(actor, parentNode, map)) {
      throw new DocumentationCreateNodeError("You cannot create under this parent");
    }
  }

  const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = nowIso();
  const folderVisibility = input.folderVisibility ?? "public";
  const groupId = folderVisibility === "group" ? (input.groupId ?? actor.groupId) : null;
  const isPrivate = Boolean(input.isPrivate);
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

  const sharedGroupIds = normalizeIds(input.sharedGroupIds);
  const sharedUserIds = normalizeIds(input.sharedUserIds);
  await syncNodeShares(id, sharedGroupIds, sharedUserIds);

  return {
    id,
    parentId: input.parentId,
    kind: input.kind,
    title,
    subtitle,
    coverMediaId,
    isPublic,
    ownerId: actor.id,
    folderVisibility,
    groupId,
    sharedGroupIds,
    sharedUserIds,
    isPrivate,
    content: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateDocumentationNode(
  actor: DocumentationActorScope,
  nodeId: string,
  patch: {
    title?: string;
    subtitle?: string;
    coverMediaId?: string | null;
    isPublic?: boolean;
    sharedGroupIds?: string[];
    sharedUserIds?: string[];
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

  if (patch.sharedGroupIds !== undefined || patch.sharedUserIds !== undefined) {
    await syncNodeShares(nodeId, patch.sharedGroupIds, patch.sharedUserIds);
  }

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
    if (!parent || (parent.kind !== "folder" && parent.kind !== "page")) return null;
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
    contentBytes?: Buffer;
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
      (id, nodeId, ownerId, fileName, mimeType, sizeBytes, storagePath, contentBytes, createdAt, updatedAt)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      input.nodeId,
      actor.id,
      input.fileName,
      input.mimeType,
      input.sizeBytes,
      input.storagePath,
      input.contentBytes ?? null,
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

function normalizeIds(values?: string[]): string[] {
  if (!values) return [];
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)));
}

async function syncNodeShares(nodeId: string, sharedGroupIds?: string[], sharedUserIds?: string[]) {
  const now = nowIso();

  if (sharedGroupIds !== undefined) {
    const groups = normalizeIds(sharedGroupIds);
    await pgPool.query("DELETE FROM documentation_node_group_shares WHERE nodeId = $1", [nodeId]);
    for (const groupId of groups) {
      await pgPool.query(
        "INSERT INTO documentation_node_group_shares (nodeId, groupId, createdAt) VALUES ($1,$2,$3)",
        [nodeId, groupId, now]
      );
    }
  }

  if (sharedUserIds !== undefined) {
    const users = normalizeIds(sharedUserIds);
    await pgPool.query("DELETE FROM documentation_node_user_shares WHERE nodeId = $1", [nodeId]);
    for (const accountId of users) {
      await pgPool.query(
        "INSERT INTO documentation_node_user_shares (nodeId, accountId, createdAt) VALUES ($1,$2,$3)",
        [nodeId, accountId, now]
      );
    }
  }
}

async function ensureActorPrivateRoot(actor: DocumentationActorScope) {
  await ensurePostgresReady();

  const existing = await pgPool.query(
    "SELECT id FROM documentation_nodes WHERE parentId IS NULL AND kind = 'folder' AND ownerId = $1 AND isPrivate = 1 LIMIT 1",
    [actor.id]
  );

  if (existing.rows[0]?.id) return;

  const now = nowIso();
  const id = `doc_root_private_${actor.id}`;
  await pgPool.query(
    `INSERT INTO documentation_nodes
      (id, parentId, kind, title, subtitle, coverMediaId, isPublic, ownerId, folderVisibility, groupId, isPrivate, contentJson, createdAt, updatedAt)
     VALUES ($1,NULL,'folder',$2,'',NULL,0,$3,'group',$4,1,'[]',$5,$6)
     ON CONFLICT (id) DO NOTHING`,
    [id, "Private", actor.id, actor.groupId, now, now]
  );
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

export async function getDocumentationMediaBinaryForActor(
  actor: DocumentationActorScope,
  mediaId: string
): Promise<{ media: DocumentationMedia; contentBytes: Buffer | null } | null> {
  await ensurePostgresReady();

  const mediaResult = await pgPool.query("SELECT * FROM documentation_media WHERE id = $1", [mediaId]);
  const mediaRow = mediaResult.rows[0] as DocumentationMediaRow | undefined;
  if (!mediaRow) return null;

  const node = await getDocumentationNodeForActor(actor, mediaRow.nodeid);
  if (!node) return null;

  return {
    media: {
      id: mediaRow.id,
      nodeId: mediaRow.nodeid,
      ownerId: mediaRow.ownerid,
      fileName: mediaRow.filename,
      mimeType: mediaRow.mimetype,
      sizeBytes: Number(mediaRow.sizebytes ?? 0),
      storagePath: mediaRow.storagepath,
      createdAt: mediaRow.createdat,
      updatedAt: mediaRow.updatedat,
    },
    contentBytes: mediaRow.contentbytes ?? null,
  };
}
