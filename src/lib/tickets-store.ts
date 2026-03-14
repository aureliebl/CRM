import { getSharedPgPool } from "@/lib/pg-pool";
import { sanitizeHtml } from "@/lib/html-sanitize";
import { hashToken } from "@/lib/vault-crypto";
import crypto from "crypto";

/* ─────────── PG pool ─────────── */

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const pgPool = getSharedPgPool({
  connectionString: databaseUrl,
  max: Math.max(1, Number(process.env.PGPOOL_MAX_CONNECTIONS || 1)),
  min: Math.max(0, Number(process.env.PGPOOL_MIN_CONNECTIONS || 0)),
  connectionTimeoutMillis: Math.max(1000, Number(process.env.PG_CONNECTION_TIMEOUT_MS || 15000)),
  idleTimeoutMillis: Math.max(1000, Number(process.env.PG_IDLE_TIMEOUT_MS || 10000)),
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});

let postgresReady: Promise<void> | null = null;
const now = () => new Date().toISOString();

/* ─────────── Default board columns ─────────── */

export const DEFAULT_COLUMNS = [
  { key: "nouveau", labelFr: "Nouveau", labelEn: "New", color: "#6366f1" },
  { key: "en_cours", labelFr: "En cours", labelEn: "In Progress", color: "#f59e0b" },
  { key: "en_attente", labelFr: "En attente", labelEn: "Waiting", color: "#8b5cf6" },
  { key: "resolu", labelFr: "Résolu", labelEn: "Resolved", color: "#16a34a" },
  { key: "ferme", labelFr: "Fermé", labelEn: "Closed", color: "#6b7280" },
];

/* ─────────── Schema ─────────── */

async function ensurePostgresSchema() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS ticket_boards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      columns TEXT NOT NULL DEFAULT '[]',
      created_at TEXT,
      updated_at TEXT
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS ticket_cards (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      column_key TEXT NOT NULL DEFAULT 'nouveau',
      position INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      description TEXT,
      variables TEXT DEFAULT '[]',
      assignee_id TEXT,
      follower_ids TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'manual',
      created_by TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  await pgPool.query("ALTER TABLE ticket_cards ADD COLUMN IF NOT EXISTS assignee_id TEXT");
  await pgPool.query("ALTER TABLE ticket_cards ADD COLUMN IF NOT EXISTS follower_ids TEXT NOT NULL DEFAULT '[]'");

  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_ticket_cards_board ON ticket_cards(board_id)`);
  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_ticket_cards_column ON ticket_cards(board_id, column_key, position)`);
  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_ticket_cards_assignee ON ticket_cards(assignee_id)`);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS ticket_api_tokens (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      board_id TEXT NOT NULL,
      created_by TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT
    )
  `);
}

async function ensurePostgresReady() {
  if (!postgresReady) postgresReady = ensurePostgresSchema();
  await postgresReady;
}

/* ─────────── Types ─────────── */

export interface TicketVariable {
  key: string;
  value: string;
  type: "badge" | "date" | "text" | "link" | "progress";
  color?: string; // for badge: red, blue, green, orange, yellow, gray, purple
}

export interface TicketCard {
  id: string;
  boardId: string;
  columnKey: string;
  position: number;
  title: string;
  description: string | null;
  variables: TicketVariable[];
  assigneeId: string | null;
  followerIds: string[];
  source: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketBoard {
  id: string;
  name: string;
  columns: typeof DEFAULT_COLUMNS;
  createdAt: string;
  updatedAt: string;
}

export interface TicketApiToken {
  id: string;
  label: string;
  boardId: string;
  createdBy: string | null;
  isActive: boolean;
  createdAt: string;
}

/* ─────────── Helpers ─────────── */

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function parseRow(row: Record<string, unknown>): TicketCard {
  let variables: TicketVariable[] = [];
  let followerIds: string[] = [];
  try {
    const raw = String(row.variables ?? "[]");
    variables = JSON.parse(raw);
  } catch { /* default empty */ }

  try {
    const rawFollowers = String(row.follower_ids ?? "[]");
    const parsed = JSON.parse(rawFollowers);
    if (Array.isArray(parsed)) {
      followerIds = parsed
        .map((value) => String(value || "").trim())
        .filter(Boolean);
    }
  } catch { /* default empty */ }

  return {
    id: String(row.id ?? ""),
    boardId: String(row.board_id ?? ""),
    columnKey: String(row.column_key ?? "nouveau"),
    position: Number(row.position ?? 0),
    title: String(row.title ?? ""),
    description: row.description ? String(row.description) : null,
    variables,
    assigneeId: row.assignee_id ? String(row.assignee_id) : null,
    followerIds,
    source: String(row.source ?? "manual"),
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

/* ─────────── Board ─────────── */

export async function ensureDefaultBoard(): Promise<TicketBoard> {
  await ensurePostgresReady();

  const existing = await pgPool.query("SELECT * FROM ticket_boards LIMIT 1");
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    let columns = DEFAULT_COLUMNS;
    try { columns = JSON.parse(String(row.columns)); } catch { /* use defaults */ }
    return {
      id: String(row.id),
      name: String(row.name),
      columns,
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
    };
  }

  const id = genId("tb");
  const ts = now();
  await pgPool.query(
    "INSERT INTO ticket_boards (id, name, columns, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)",
    [id, "Tickets", JSON.stringify(DEFAULT_COLUMNS), ts, ts]
  );

  return { id, name: "Tickets", columns: DEFAULT_COLUMNS, createdAt: ts, updatedAt: ts };
}

/* ─────────── Cards CRUD ─────────── */

export async function getCards(boardId: string): Promise<TicketCard[]> {
  await ensurePostgresReady();
  const result = await pgPool.query(
    "SELECT * FROM ticket_cards WHERE board_id = $1 ORDER BY column_key, position ASC",
    [boardId]
  );
  return result.rows.map(parseRow);
}

export async function getCardById(cardId: string): Promise<TicketCard | null> {
  await ensurePostgresReady();
  const result = await pgPool.query("SELECT * FROM ticket_cards WHERE id = $1", [cardId]);
  if (result.rows.length === 0) return null;
  return parseRow(result.rows[0]);
}

export async function createCard(input: {
  boardId: string;
  title: string;
  description?: string | null;
  variables?: TicketVariable[];
  columnKey?: string;
  assigneeId?: string | null;
  followerIds?: string[];
  source?: string;
  createdBy?: string | null;
}): Promise<TicketCard> {
  await ensurePostgresReady();
  const id = genId("tc");
  const ts = now();
  const col = input.columnKey || "nouveau";

  // Get next position for this column
  const posResult = await pgPool.query(
    "SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM ticket_cards WHERE board_id = $1 AND column_key = $2",
    [input.boardId, col]
  );
  const position = Number(posResult.rows[0]?.next_pos ?? 0);

  const desc = input.description ? sanitizeHtml(input.description) : null;
  const vars = JSON.stringify(input.variables || []);

  const followerIds = Array.from(new Set((input.followerIds || []).map((value) => String(value || "").trim()).filter(Boolean)));

  await pgPool.query(
    `INSERT INTO ticket_cards (id, board_id, column_key, position, title, description, variables, assignee_id, follower_ids, source, created_by, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [id, input.boardId, col, position, input.title, desc, vars, input.assigneeId || null, JSON.stringify(followerIds), input.source || "manual", input.createdBy || null, ts, ts]
  );

  return {
    id,
    boardId: input.boardId,
    columnKey: col,
    position,
    title: input.title,
    description: desc,
    variables: input.variables || [],
    assigneeId: input.assigneeId || null,
    followerIds,
    source: input.source || "manual",
    createdBy: input.createdBy || null,
    createdAt: ts,
    updatedAt: ts,
  };
}

export async function updateCard(
  cardId: string,
  patch: {
    title?: string;
    description?: string | null;
    variables?: TicketVariable[];
    columnKey?: string;
    position?: number;
    assigneeId?: string | null;
    followerIds?: string[];
  }
): Promise<void> {
  await ensurePostgresReady();
  const ts = now();

  const sets: string[] = ["updated_at = $1"];
  const params: unknown[] = [ts];
  let idx = 2;

  if (patch.title !== undefined) {
    sets.push(`title = $${idx++}`);
    params.push(patch.title);
  }
  if (patch.description !== undefined) {
    sets.push(`description = $${idx++}`);
    params.push(patch.description ? sanitizeHtml(patch.description) : null);
  }
  if (patch.variables !== undefined) {
    sets.push(`variables = $${idx++}`);
    params.push(JSON.stringify(patch.variables));
  }
  if (patch.assigneeId !== undefined) {
    sets.push(`assignee_id = $${idx++}`);
    params.push(patch.assigneeId || null);
  }
  if (patch.followerIds !== undefined) {
    sets.push(`follower_ids = $${idx++}`);
    const followerIds = Array.from(new Set(patch.followerIds.map((value) => String(value || "").trim()).filter(Boolean)));
    params.push(JSON.stringify(followerIds));
  }
  if (patch.columnKey !== undefined) {
    sets.push(`column_key = $${idx++}`);
    params.push(patch.columnKey);
  }
  if (patch.position !== undefined) {
    sets.push(`position = $${idx++}`);
    params.push(patch.position);
  }

  params.push(cardId);
  await pgPool.query(
    `UPDATE ticket_cards SET ${sets.join(", ")} WHERE id = $${idx}`,
    params
  );
}

export async function deleteCard(cardId: string): Promise<void> {
  await ensurePostgresReady();
  await pgPool.query("DELETE FROM ticket_cards WHERE id = $1", [cardId]);
}

export async function moveCard(
  cardId: string,
  columnKey: string,
  position: number
): Promise<void> {
  await ensurePostgresReady();
  const ts = now();

  // Get current card
  const card = await getCardById(cardId);
  if (!card) return;

  // Shift cards in the target column to make room
  await pgPool.query(
    "UPDATE ticket_cards SET position = position + 1 WHERE board_id = $1 AND column_key = $2 AND position >= $3 AND id != $4",
    [card.boardId, columnKey, position, cardId]
  );

  // Move the card
  await pgPool.query(
    "UPDATE ticket_cards SET column_key = $1, position = $2, updated_at = $3 WHERE id = $4",
    [columnKey, position, ts, cardId]
  );
}

/* ─────────── API Tokens ─────────── */

export async function createApiToken(
  boardId: string,
  label: string,
  createdBy: string
): Promise<{ token: string; record: TicketApiToken }> {
  await ensurePostgresReady();
  const id = genId("tat");
  const ts = now();

  // Generate a token
  const token = crypto.randomBytes(32).toString("hex");
  const hash = hashToken(token);

  await pgPool.query(
    "INSERT INTO ticket_api_tokens (id, token_hash, label, board_id, created_by, is_active, created_at) VALUES ($1,$2,$3,$4,$5,1,$6)",
    [id, hash, label, boardId, createdBy, ts]
  );

  return {
    token, // returned once in clear text
    record: { id, label, boardId, createdBy, isActive: true, createdAt: ts },
  };
}

export async function validateApiToken(token: string): Promise<{ boardId: string } | null> {
  await ensurePostgresReady();
  const hash = hashToken(token);

  const result = await pgPool.query(
    "SELECT board_id FROM ticket_api_tokens WHERE token_hash = $1 AND is_active = 1",
    [hash]
  );

  if (result.rows.length === 0) return null;
  return { boardId: String(result.rows[0].board_id) };
}

export async function getApiTokens(boardId: string): Promise<TicketApiToken[]> {
  await ensurePostgresReady();
  const result = await pgPool.query(
    "SELECT * FROM ticket_api_tokens WHERE board_id = $1 ORDER BY created_at DESC",
    [boardId]
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    label: String(row.label ?? ""),
    boardId: String(row.board_id),
    createdBy: row.created_by ? String(row.created_by) : null,
    isActive: Number(row.is_active) === 1,
    createdAt: String(row.created_at ?? ""),
  }));
}

export async function deactivateApiToken(tokenId: string): Promise<void> {
  await ensurePostgresReady();
  await pgPool.query("UPDATE ticket_api_tokens SET is_active = 0 WHERE id = $1", [tokenId]);
}
