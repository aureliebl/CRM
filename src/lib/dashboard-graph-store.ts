import { Pool } from "pg";
import type { DashboardGraph, DashboardGraphConfig, DashboardGraphSize } from "@/lib/types";

type SqliteCompat = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
    run: (...args: unknown[]) => unknown;
  };
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required (runtime is PostgreSQL-only)");
}

const usePostgres = true;

let sqliteDb: SqliteCompat | null =
  process.env.ENABLE_SQLITE_LEGACY === "true"
    ? {
        exec: () => {
          throw new Error("SQLite legacy mode is disabled");
        },
        prepare: () => {
          throw new Error("SQLite legacy mode is disabled");
        },
      }
    : null;

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

if (sqliteDb) {
  sqliteDb.exec(`
CREATE TABLE IF NOT EXISTS dashboard_graphs (
  id TEXT PRIMARY KEY,
  ownerUserId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  size TEXT NOT NULL DEFAULT 'M',
  layoutOrder INTEGER NOT NULL DEFAULT 0,
  isShared INTEGER NOT NULL DEFAULT 0,
  sharedFromGraphId TEXT,
  config TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dashboard_graphs_owner
ON dashboard_graphs(ownerUserId);

CREATE INDEX IF NOT EXISTS idx_dashboard_graphs_shared
ON dashboard_graphs(isShared);
`);
}

export type DashboardGraphRow = {
  id: string;
  ownerUserId: string;
  title: string;
  description?: string | null;
  size: DashboardGraphSize;
  layoutOrder: number;
  isShared: number;
  sharedFromGraphId?: string | null;
  config: string;
  createdAt: string;
  updatedAt: string;
};

function mapPgRow(row: Record<string, unknown>): DashboardGraphRow {
  return {
    id: String(row.id ?? ""),
    ownerUserId: String(row.owneruserid ?? row.ownerUserId ?? ""),
    title: String(row.title ?? ""),
    description: (row.description as string | null | undefined) ?? null,
    size: String(row.size ?? "M") as DashboardGraphSize,
    layoutOrder: Number(row.layoutorder ?? row.layoutOrder ?? 0),
    isShared: Number(row.isshared ?? row.isShared ?? 0),
    sharedFromGraphId:
      (row.sharedfromgraphid as string | null | undefined) ??
      (row.sharedFromGraphId as string | null | undefined) ??
      null,
    config: String(row.config ?? "{}"),
    createdAt: String(row.createdat ?? row.createdAt ?? ""),
    updatedAt: String(row.updatedat ?? row.updatedAt ?? ""),
  };
}

async function ensurePostgresSchema() {
  if (!pgPool) return;

  await pgPool.query(`
CREATE TABLE IF NOT EXISTS dashboard_graphs (
  id TEXT PRIMARY KEY,
  ownerUserId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  size TEXT NOT NULL DEFAULT 'M',
  layoutOrder INTEGER NOT NULL DEFAULT 0,
  isShared INTEGER NOT NULL DEFAULT 0,
  sharedFromGraphId TEXT,
  config TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
)
`);

  await pgPool.query("CREATE INDEX IF NOT EXISTS idx_dashboard_graphs_owner ON dashboard_graphs(ownerUserId)");
  await pgPool.query("CREATE INDEX IF NOT EXISTS idx_dashboard_graphs_shared ON dashboard_graphs(isShared)");
}

async function ensurePostgresReady() {
  if (!usePostgres || !pgPool) return;
  if (!postgresReady) {
    postgresReady = ensurePostgresSchema();
  }
  await postgresReady;
}

function parseConfig(config: string): DashboardGraphConfig {
  try {
    const parsed = JSON.parse(config) as DashboardGraphConfig;
    return {
      source: parsed.source,
      chartType: parsed.chartType,
      groupBy: parsed.groupBy,
      metricField: parsed.metricField,
      xField: parsed.xField,
      yField: parsed.yField,
      timeField: parsed.timeField,
      dateFrom: parsed.dateFrom,
      dateTo: parsed.dateTo,
      timeGranularity: parsed.timeGranularity ?? "month",
      mapRegion: parsed.mapRegion ?? "france",
      mapZoom: parsed.mapZoom ?? 3,
      join: parsed.join
        ? {
            enabled: !!parsed.join.enabled,
            source: parsed.join.source,
            leftKey: parsed.join.leftKey,
            rightKey: parsed.join.rightKey,
          }
        : undefined,
      aggregation: parsed.aggregation ?? "count",
      limit: parsed.limit ?? 8,
      sortDirection: parsed.sortDirection ?? "desc",
      color: parsed.color ?? "#2563eb",
      valueFormat: parsed.valueFormat ?? "number",
      filters: Array.isArray(parsed.filters) ? parsed.filters : [],
      connectorId: parsed.connectorId,
      externalTable: parsed.externalTable,
    };
  } catch {
    return {
      source: "bookings",
      chartType: "bar",
      timeGranularity: "month",
      mapRegion: "france",
      mapZoom: 3,
      join: undefined,
      aggregation: "count",
      limit: 8,
      sortDirection: "desc",
      color: "#2563eb",
      valueFormat: "number",
      filters: [],
    };
  }
}

function toDomain(row: DashboardGraphRow): DashboardGraph {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    title: row.title,
    description: row.description ?? undefined,
    size: row.size,
    layoutOrder: row.layoutOrder,
    isShared: !!row.isShared,
    sharedFromGraphId: row.sharedFromGraphId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    config: parseConfig(row.config),
  };
}

export async function listGraphsByOwner(ownerUserId: string): Promise<DashboardGraph[]> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query(
      "SELECT * FROM dashboard_graphs WHERE ownerUserId = $1 ORDER BY layoutOrder ASC, createdAt ASC",
      [ownerUserId]
    );
    return result.rows.map((row) => toDomain(mapPgRow(row as Record<string, unknown>)));
  }

  if (!sqliteDb) return [];
  const stmt = sqliteDb.prepare(
    "SELECT * FROM dashboard_graphs WHERE ownerUserId = ? ORDER BY layoutOrder ASC, createdAt ASC"
  );
  return (stmt.all(ownerUserId) as DashboardGraphRow[]).map(toDomain);
}

export async function listSharedGraphs(): Promise<DashboardGraph[]> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query("SELECT * FROM dashboard_graphs WHERE isShared = 1 ORDER BY updatedAt DESC");
    return result.rows.map((row) => toDomain(mapPgRow(row as Record<string, unknown>)));
  }

  if (!sqliteDb) return [];
  const stmt = sqliteDb.prepare(
    "SELECT * FROM dashboard_graphs WHERE isShared = 1 ORDER BY updatedAt DESC"
  );
  return (stmt.all() as DashboardGraphRow[]).map(toDomain);
}

export async function getGraphById(id: string): Promise<DashboardGraph | undefined> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query("SELECT * FROM dashboard_graphs WHERE id = $1", [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? toDomain(mapPgRow(row)) : undefined;
  }

  if (!sqliteDb) return undefined;
  const stmt = sqliteDb.prepare("SELECT * FROM dashboard_graphs WHERE id = ?");
  const row = stmt.get(id) as DashboardGraphRow | undefined;
  return row ? toDomain(row) : undefined;
}

export async function createGraph(input: {
  ownerUserId: string;
  title: string;
  description?: string;
  size?: DashboardGraphSize;
  layoutOrder?: number;
  isShared?: boolean;
  sharedFromGraphId?: string | null;
  config: DashboardGraphConfig;
}): Promise<DashboardGraph> {
  const id = `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query(
      `
      INSERT INTO dashboard_graphs (
        id, ownerUserId, title, description, size, layoutOrder,
        isShared, sharedFromGraphId, config, createdAt, updatedAt
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        id,
        input.ownerUserId,
        input.title,
        input.description ?? null,
        input.size ?? "M",
        input.layoutOrder ?? 0,
        input.isShared ? 1 : 0,
        input.sharedFromGraphId ?? null,
        JSON.stringify(input.config),
        now,
        now,
      ]
    );

    return (await getGraphById(id))!;
  }

  if (!sqliteDb) {
    throw new Error("Graph store is not initialized");
  }

  const stmt = sqliteDb.prepare(`
    INSERT INTO dashboard_graphs (
      id, ownerUserId, title, description, size, layoutOrder,
      isShared, sharedFromGraphId, config, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.ownerUserId,
    input.title,
    input.description ?? null,
    input.size ?? "M",
    input.layoutOrder ?? 0,
    input.isShared ? 1 : 0,
    input.sharedFromGraphId ?? null,
    JSON.stringify(input.config),
    now,
    now
  );

  return (await getGraphById(id))!;
}

export async function updateGraph(
  id: string,
  patch: Partial<{
    ownerUserId: string;
    title: string;
    description: string;
    size: DashboardGraphSize;
    layoutOrder: number;
    isShared: boolean;
    config: DashboardGraphConfig;
  }>
): Promise<DashboardGraph | undefined> {
  const existing = await getGraphById(id);
  if (!existing) return undefined;

  const cleanPatch = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined)
  );

  const updated = {
    ...existing,
    ...cleanPatch,
    config: patch.config ?? existing.config,
    updatedAt: new Date().toISOString(),
  };

  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query(
      `
      UPDATE dashboard_graphs
      SET ownerUserId = $1, title = $2, description = $3, size = $4, layoutOrder = $5,
          isShared = $6, config = $7, updatedAt = $8
      WHERE id = $9
      `,
      [
        updated.ownerUserId,
        updated.title,
        updated.description ?? null,
        updated.size,
        updated.layoutOrder,
        updated.isShared ? 1 : 0,
        JSON.stringify(updated.config),
        updated.updatedAt,
        id,
      ]
    );

    return getGraphById(id);
  }

  if (!sqliteDb) return undefined;

  const stmt = sqliteDb.prepare(`
    UPDATE dashboard_graphs
    SET ownerUserId = ?, title = ?, description = ?, size = ?, layoutOrder = ?,
        isShared = ?, config = ?, updatedAt = ?
    WHERE id = ?
  `);

  stmt.run(
    updated.ownerUserId,
    updated.title,
    updated.description ?? null,
    updated.size,
    updated.layoutOrder,
    updated.isShared ? 1 : 0,
    JSON.stringify(updated.config),
    updated.updatedAt,
    id
  );

  return getGraphById(id);
}

export async function deleteGraph(id: string): Promise<void> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query("DELETE FROM dashboard_graphs WHERE id = $1", [id]);
    return;
  }

  if (!sqliteDb) return;
  const stmt = sqliteDb.prepare("DELETE FROM dashboard_graphs WHERE id = ?");
  stmt.run(id);
}

export async function duplicateSharedGraphForUser(input: {
  graphId: string;
  ownerUserId: string;
}): Promise<DashboardGraph | undefined> {
  const source = await getGraphById(input.graphId);
  if (!source || !source.isShared) return undefined;

  return createGraph({
    ownerUserId: input.ownerUserId,
    title: source.title,
    description: source.description,
    size: source.size,
    layoutOrder: source.layoutOrder,
    isShared: false,
    sharedFromGraphId: source.id,
    config: source.config,
  });
}
