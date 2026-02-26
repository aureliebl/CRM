import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import { Pool } from "pg";
import { decryptText, encryptText } from "@/lib/crypto";
import type { DataConnector, DataConnectorProvider } from "@/lib/types";

const dbProvider = process.env.DB_PROVIDER ?? (process.env.DATABASE_URL ? "postgres" : "sqlite");
const usePostgres = dbProvider === "postgres";

const sqliteDb = (() => {
  if (usePostgres) return null;

  const dataDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "accounts.db");
  return new Database(dbPath);
})();
const pgPool =
  usePostgres && process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl:
          process.env.PGSSL === "true"
            ? {
                rejectUnauthorized: false,
              }
            : undefined,
      })
    : null;

let postgresReady: Promise<void> | null = null;

if (sqliteDb) {
  sqliteDb.exec(`
CREATE TABLE IF NOT EXISTS data_connectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  configEncrypted TEXT NOT NULL,
  createdBy TEXT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT
);
`);
}

type ConnectorRow = {
  id: string;
  name: string;
  provider: string;
  enabled: number;
  configEncrypted: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

const nowIso = () => new Date().toISOString();

async function ensurePostgresSchema() {
  if (!pgPool) return;

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS data_connectors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      configEncrypted TEXT NOT NULL,
      createdBy TEXT NOT NULL,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);
}

async function ensureDefaultMockConnectorPostgres() {
  if (!pgPool) return;

  const existing = await pgPool.query(
    "SELECT id FROM data_connectors WHERE provider = 'mock' ORDER BY createdAt ASC LIMIT 1"
  );
  if (existing.rows[0]?.id) return;

  const now = nowIso();
  await pgPool.query(
    "INSERT INTO data_connectors (id, name, provider, enabled, configEncrypted, createdBy, createdAt, updatedAt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      "conn_mock_default",
      "Mock data",
      "mock",
      1,
      encryptText(JSON.stringify({ preset: "internal-mock" })),
      "system",
      now,
      now,
    ]
  );
}

async function ensurePostgresReady() {
  if (!usePostgres || !pgPool) return;
  if (!postgresReady) {
    postgresReady = (async () => {
      await ensurePostgresSchema();
      await ensureDefaultMockConnectorPostgres();
    })();
  }
  await postgresReady;
}

function ensureDefaultMockConnectorSqlite() {
  if (!sqliteDb) return;

  const existing = sqliteDb
    .prepare("SELECT id FROM data_connectors WHERE provider = 'mock' ORDER BY createdAt ASC LIMIT 1")
    .get() as { id?: string } | undefined;
  if (existing?.id) return;

  const now = nowIso();
  sqliteDb.prepare(
    "INSERT INTO data_connectors (id, name, provider, enabled, configEncrypted, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)"
  ).run(
    "conn_mock_default",
    "Mock data",
    "mock",
    1,
    encryptText(JSON.stringify({ preset: "internal-mock" })),
    "system",
    now,
    now
  );
}

ensureDefaultMockConnectorSqlite();

function mapRow(row: ConnectorRow): DataConnector {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider as DataConnectorProvider,
    enabled: row.enabled === 1,
    configEncrypted: row.configEncrypted,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapPgRow(row: Record<string, unknown>): DataConnector {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    provider: String(row.provider ?? "mock") as DataConnectorProvider,
    enabled: Number(row.enabled ?? 0) === 1,
    configEncrypted: String(row.configencrypted ?? row.configEncrypted ?? ""),
    createdBy: String(row.createdby ?? row.createdBy ?? ""),
    createdAt: String(row.createdat ?? row.createdAt ?? ""),
    updatedAt: String(row.updatedat ?? row.updatedAt ?? ""),
  };
}

export async function getConnectors(): Promise<DataConnector[]> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query("SELECT * FROM data_connectors ORDER BY createdAt DESC");
    return result.rows.map((row) => mapPgRow(row as Record<string, unknown>));
  }

  if (!sqliteDb) return [];

  const rows = sqliteDb.prepare("SELECT * FROM data_connectors ORDER BY createdAt DESC").all() as ConnectorRow[];
  return rows.map(mapRow);
}

export async function createConnector(input: {
  name: string;
  provider: DataConnectorProvider;
  config: Record<string, unknown>;
  createdBy: string;
}): Promise<DataConnector | undefined> {
  const now = nowIso();
  const id = `conn_${Date.now()}`;
  const encrypted = encryptText(JSON.stringify(input.config));

  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query(
      "INSERT INTO data_connectors (id, name, provider, enabled, configEncrypted, createdBy, createdAt, updatedAt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [id, input.name, input.provider, 1, encrypted, input.createdBy, now, now]
    );
    return (await getConnectors()).find((item) => item.id === id);
  }

  if (!sqliteDb) return undefined;

  sqliteDb.prepare(
    "INSERT INTO data_connectors (id, name, provider, enabled, configEncrypted, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)"
  ).run(id, input.name, input.provider, 1, encrypted, input.createdBy, now, now);

  return (await getConnectors()).find((item) => item.id === id);
}

export async function getConnectorById(id: string): Promise<DataConnector | undefined> {
  return (await getConnectors()).find((item) => item.id === id);
}

export async function getActiveConnector(preferredConnectorId?: string): Promise<DataConnector | null> {
  if (preferredConnectorId) {
    const preferred = await getConnectorById(preferredConnectorId);
    if (preferred && preferred.enabled) return preferred;
  }

  const all = (await getConnectors()).filter((item) => item.enabled);
  if (all.length === 0) return null;

  const firstBigQuery = all.find((item) => item.provider === "bigquery");
  if (firstBigQuery) return firstBigQuery;

  return all[0] ?? null;
}

export function updateConnector(
  id: string,
  patch: {
    name?: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
  }
): Promise<DataConnector | undefined> {
  return updateConnectorInternal(id, patch);
}

async function updateConnectorInternal(
  id: string,
  patch: {
    name?: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
  }
): Promise<DataConnector | undefined> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const existingResult = await pgPool.query("SELECT * FROM data_connectors WHERE id = $1", [id]);
    const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
    if (!existing) return undefined;

    const existingEncrypted = String(existing.configencrypted ?? existing.configEncrypted ?? "");
    const nextConfig =
      patch.config !== undefined
        ? patch.config
        : (() => {
            try {
              return JSON.parse(decryptText(existingEncrypted));
            } catch {
              return {};
            }
          })();

    const encrypted = encryptText(JSON.stringify(nextConfig));

    await pgPool.query(
      "UPDATE data_connectors SET name = $1, enabled = $2, configEncrypted = $3, updatedAt = $4 WHERE id = $5",
      [
        patch.name ?? String(existing.name ?? ""),
        patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : Number(existing.enabled ?? 0),
        encrypted,
        nowIso(),
        id,
      ]
    );

    return (await getConnectors()).find((item) => item.id === id);
  }

  if (!sqliteDb) return undefined;

  const existing = sqliteDb.prepare("SELECT * FROM data_connectors WHERE id = ?").get(id) as ConnectorRow | undefined;
  if (!existing) return undefined;

  const nextConfig =
    patch.config !== undefined
      ? patch.config
      : (() => {
          try {
            return JSON.parse(decryptText(existing.configEncrypted));
          } catch {
            return {};
          }
        })();

  const encrypted = encryptText(JSON.stringify(nextConfig));

  sqliteDb.prepare(
    "UPDATE data_connectors SET name = ?, enabled = ?, configEncrypted = ?, updatedAt = ? WHERE id = ?"
  ).run(
    patch.name ?? existing.name,
    patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : existing.enabled,
    encrypted,
    nowIso(),
    id
  );

  return (await getConnectors()).find((item) => item.id === id);
}

export async function deleteConnector(id: string): Promise<void> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query("DELETE FROM data_connectors WHERE id = $1", [id]);
    return;
  }

  if (!sqliteDb) return;

  sqliteDb.prepare("DELETE FROM data_connectors WHERE id = ?").run(id);
}

export async function getConnectorConfig(id: string): Promise<Record<string, unknown> | null> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query("SELECT configEncrypted FROM data_connectors WHERE id = $1", [id]);
    const encrypted = result.rows[0]?.configencrypted ?? result.rows[0]?.configEncrypted;
    if (!encrypted || typeof encrypted !== "string") return null;

    try {
      return JSON.parse(decryptText(encrypted));
    } catch {
      return null;
    }
  }

  if (!sqliteDb) return null;

  const row = sqliteDb.prepare("SELECT configEncrypted FROM data_connectors WHERE id = ?").get(id) as
    | { configEncrypted: string }
    | undefined;
  if (!row) return null;

  try {
    return JSON.parse(decryptText(row.configEncrypted));
  } catch {
    return null;
  }
}
