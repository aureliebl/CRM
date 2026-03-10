import { Pool } from "pg";
import * as Y from "yjs";

const databaseUrl = process.env.DATABASE_URL || "postgres://theomingault@localhost:5432/costotest";

const pgPoolMax = Math.max(1, Number(process.env.PGPOOL_MAX_CONNECTIONS || 1));
const pgPoolMin = Math.max(0, Number(process.env.PGPOOL_MIN_CONNECTIONS || 0));
const pgConnectionTimeoutMs = Math.max(
  1000,
  Number(process.env.PG_CONNECTION_TIMEOUT_MS || 15000)
);
const pgIdleTimeoutMs = Math.max(1000, Number(process.env.PG_IDLE_TIMEOUT_MS || 10000));

const pool = new Pool({
  connectionString: databaseUrl,
  family: 4,
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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isPoolLimitError(error) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String(error.message || "") : "";
  const code = "code" in error ? String(error.code || "") : "";
  return code === "XX000" && message.includes("MaxClientsInSessionMode");
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documentation_crdt_docs (
      nodeId TEXT PRIMARY KEY,
      ydoc BYTEA NOT NULL,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS documentation_crdt_updates (
      id BIGSERIAL PRIMARY KEY,
      nodeId TEXT NOT NULL,
      actorId TEXT,
      update BYTEA NOT NULL,
      createdAt TEXT
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_documentation_crdt_updates_node
      ON documentation_crdt_updates(nodeId)
  `);
}

function nowIso() {
  return new Date().toISOString();
}

async function ensureSchemaWithRetry() {
  const attempts = Math.max(1, Number(process.env.PG_SCHEMA_RETRY_ATTEMPTS || 6));
  const delayMs = Math.max(500, Number(process.env.PG_SCHEMA_RETRY_DELAY_MS || 2000));

  for (let index = 0; index < attempts; index++) {
    try {
      await ensureSchema();
      return;
    } catch (error) {
      const isLast = index === attempts - 1;
      if (!isPoolLimitError(error) || isLast) {
        throw error;
      }
      await sleep(delayMs);
    }
  }
}

await ensureSchemaWithRetry();

export async function loadDocument(name) {
  const snapshot = await pool.query(
    "SELECT ydoc FROM documentation_crdt_docs WHERE nodeId = $1",
    [name]
  );

  if (snapshot.rows[0]?.ydoc) {
    try {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot.rows[0].ydoc);
      return Y.encodeStateAsUpdate(doc);
    } catch {
      // Ignore invalid legacy snapshot payloads and fallback to updates stream
    }
  }

  const updates = await pool.query(
    "SELECT update FROM documentation_crdt_updates WHERE nodeId = $1 ORDER BY id ASC",
    [name]
  );

  if (updates.rows.length === 0) return null;

  const merged = new Y.Doc();
  for (const row of updates.rows) {
    try {
      Y.applyUpdate(merged, row.update);
    } catch {
      // Ignore corrupted legacy update chunks
    }
  }
  return Y.encodeStateAsUpdate(merged);
}

export async function storeUpdate(name, update, actorId = null) {
  await pool.query(
    "INSERT INTO documentation_crdt_updates (nodeId, actorId, update, createdAt) VALUES ($1,$2,$3,$4)",
    [name, actorId, update, nowIso()]
  );
}

export async function storeSnapshot(name, state) {
  const now = nowIso();
  await pool.query(
    `INSERT INTO documentation_crdt_docs (nodeId, ydoc, createdAt, updatedAt)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (nodeId)
     DO UPDATE SET ydoc = EXCLUDED.ydoc, updatedAt = EXCLUDED.updatedAt`,
    [name, state, now, now]
  );
}
