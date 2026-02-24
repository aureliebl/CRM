import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import { decryptText, encryptText } from "@/lib/crypto";
import type { DataConnector, DataConnectorProvider } from "@/lib/types";

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "accounts.db");
const db = new Database(dbPath);

db.exec(`
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

function ensureDefaultMockConnector() {
  const existing = db
    .prepare("SELECT id FROM data_connectors WHERE provider = 'mock' ORDER BY createdAt ASC LIMIT 1")
    .get() as { id?: string } | undefined;
  if (existing?.id) return;

  const now = nowIso();
  db.prepare(
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

ensureDefaultMockConnector();

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

export function getConnectors(): DataConnector[] {
  const rows = db.prepare("SELECT * FROM data_connectors ORDER BY createdAt DESC").all() as ConnectorRow[];
  return rows.map(mapRow);
}

export function createConnector(input: {
  name: string;
  provider: DataConnectorProvider;
  config: Record<string, unknown>;
  createdBy: string;
}) {
  const now = nowIso();
  const id = `conn_${Date.now()}`;
  const encrypted = encryptText(JSON.stringify(input.config));

  db.prepare(
    "INSERT INTO data_connectors (id, name, provider, enabled, configEncrypted, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)"
  ).run(id, input.name, input.provider, 1, encrypted, input.createdBy, now, now);

  return getConnectors().find((item) => item.id === id);
}

export function getConnectorById(id: string): DataConnector | undefined {
  return getConnectors().find((item) => item.id === id);
}

export function getActiveConnector(preferredConnectorId?: string): DataConnector | null {
  if (preferredConnectorId) {
    const preferred = getConnectorById(preferredConnectorId);
    if (preferred && preferred.enabled) return preferred;
  }

  const all = getConnectors().filter((item) => item.enabled);
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
) {
  const existing = db.prepare("SELECT * FROM data_connectors WHERE id = ?").get(id) as ConnectorRow | undefined;
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

  db.prepare(
    "UPDATE data_connectors SET name = ?, enabled = ?, configEncrypted = ?, updatedAt = ? WHERE id = ?"
  ).run(
    patch.name ?? existing.name,
    patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : existing.enabled,
    encrypted,
    nowIso(),
    id
  );

  return getConnectors().find((item) => item.id === id);
}

export function deleteConnector(id: string) {
  db.prepare("DELETE FROM data_connectors WHERE id = ?").run(id);
}

export function getConnectorConfig(id: string): Record<string, unknown> | null {
  const row = db.prepare("SELECT configEncrypted FROM data_connectors WHERE id = ?").get(id) as
    | { configEncrypted: string }
    | undefined;
  if (!row) return null;

  try {
    return JSON.parse(decryptText(row.configEncrypted));
  } catch {
    return null;
  }
}
