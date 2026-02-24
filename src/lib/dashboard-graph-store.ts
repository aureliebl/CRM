import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import type { DashboardGraph, DashboardGraphConfig, DashboardGraphSize } from "@/lib/types";

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "accounts.db");
const db = new Database(dbPath);

db.exec(`
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

export function listGraphsByOwner(ownerUserId: string): DashboardGraph[] {
  const stmt = db.prepare(
    "SELECT * FROM dashboard_graphs WHERE ownerUserId = ? ORDER BY layoutOrder ASC, createdAt ASC"
  );
  return (stmt.all(ownerUserId) as DashboardGraphRow[]).map(toDomain);
}

export function listSharedGraphs(): DashboardGraph[] {
  const stmt = db.prepare(
    "SELECT * FROM dashboard_graphs WHERE isShared = 1 ORDER BY updatedAt DESC"
  );
  return (stmt.all() as DashboardGraphRow[]).map(toDomain);
}

export function getGraphById(id: string): DashboardGraph | undefined {
  const stmt = db.prepare("SELECT * FROM dashboard_graphs WHERE id = ?");
  const row = stmt.get(id) as DashboardGraphRow | undefined;
  return row ? toDomain(row) : undefined;
}

export function createGraph(input: {
  ownerUserId: string;
  title: string;
  description?: string;
  size?: DashboardGraphSize;
  layoutOrder?: number;
  isShared?: boolean;
  sharedFromGraphId?: string | null;
  config: DashboardGraphConfig;
}): DashboardGraph {
  const id = `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const stmt = db.prepare(`
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

  return getGraphById(id)!;
}

export function updateGraph(
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
): DashboardGraph | undefined {
  const existing = getGraphById(id);
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

  const stmt = db.prepare(`
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

export function deleteGraph(id: string): void {
  const stmt = db.prepare("DELETE FROM dashboard_graphs WHERE id = ?");
  stmt.run(id);
}

export function duplicateSharedGraphForUser(input: {
  graphId: string;
  ownerUserId: string;
}): DashboardGraph | undefined {
  const source = getGraphById(input.graphId);
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
