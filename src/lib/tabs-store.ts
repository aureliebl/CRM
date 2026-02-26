import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import { Pool } from "pg";
import type { DynamicTab, DynamicTabConfig } from "@/lib/types";

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
CREATE TABLE IF NOT EXISTS app_tabs (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  icon TEXT,
  enabled INTEGER DEFAULT 1,
  isSystem INTEGER DEFAULT 0,
  createdBy TEXT NOT NULL,
  configJson TEXT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS app_tab_group_visibility (
  tabId TEXT NOT NULL,
  groupId TEXT NOT NULL,
  createdAt TEXT,
  PRIMARY KEY (tabId, groupId)
);
`);
}

const nowIso = () => new Date().toISOString();

const DEFAULT_TAB_CONFIG: DynamicTabConfig = {
  source: "centers",
  columns: [
    { key: "name", sourceField: "name", label: "Nom", format: "text", filterType: "text" },
    { key: "city", sourceField: "city", label: "Ville", format: "text", filterType: "text" },
    { key: "code", sourceField: "code", label: "Code", format: "text", filterType: "text" },
  ],
  rowNavigation: {
    enabled: false,
    idField: "id",
    hrefBasePath: "/centers",
  },
};

type TabRow = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  icon?: string | null;
  enabled: number;
  isSystem: number;
  createdBy: string;
  configJson: string;
  createdAt: string;
  updatedAt: string;
};

function mapPgRow(row: Record<string, unknown>): TabRow {
  return {
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    subtitle: (row.subtitle as string | null | undefined) ?? null,
    icon: (row.icon as string | null | undefined) ?? null,
    enabled: Number(row.enabled ?? 0),
    isSystem: Number(row.issystem ?? row.isSystem ?? 0),
    createdBy: String(row.createdby ?? row.createdBy ?? ""),
    configJson: String(row.configjson ?? row.configJson ?? "{}"),
    createdAt: String(row.createdat ?? row.createdAt ?? ""),
    updatedAt: String(row.updatedat ?? row.updatedAt ?? ""),
  };
}

async function ensurePostgresSchema() {
  if (!pgPool) return;

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS app_tabs (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      icon TEXT,
      enabled INTEGER DEFAULT 1,
      isSystem INTEGER DEFAULT 0,
      createdBy TEXT NOT NULL,
      configJson TEXT NOT NULL,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS app_tab_group_visibility (
      tabId TEXT NOT NULL,
      groupId TEXT NOT NULL,
      createdAt TEXT,
      PRIMARY KEY (tabId, groupId)
    )
  `);
}

async function ensurePostgresReady() {
  if (!usePostgres || !pgPool) return;
  if (!postgresReady) {
    postgresReady = ensurePostgresSchema();
  }
  await postgresReady;
}

function parseTabRow(row: TabRow): DynamicTab {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    icon: row.icon ?? undefined,
    enabled: row.enabled === 1,
    isSystem: row.isSystem === 1,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    config: (() => {
      try {
        const parsed = JSON.parse(row.configJson);
        return parsed as DynamicTabConfig;
      } catch {
        return DEFAULT_TAB_CONFIG;
      }
    })(),
  };
}

export async function getAllTabs(): Promise<DynamicTab[]> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query("SELECT * FROM app_tabs ORDER BY isSystem DESC, createdAt ASC");
    return result.rows.map((row) => parseTabRow(mapPgRow(row as Record<string, unknown>)));
  }

  if (!sqliteDb) return [];
  const rows = sqliteDb
    .prepare("SELECT * FROM app_tabs ORDER BY isSystem DESC, createdAt ASC")
    .all() as TabRow[];
  return rows.map(parseTabRow);
}

export async function getTabById(id: string): Promise<DynamicTab | undefined> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query("SELECT * FROM app_tabs WHERE id = $1", [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return parseTabRow(mapPgRow(row));
  }

  if (!sqliteDb) return undefined;
  const row = sqliteDb.prepare("SELECT * FROM app_tabs WHERE id = ?").get(id) as TabRow | undefined;
  if (!row) return undefined;
  return parseTabRow(row);
}

export async function getTabBySlug(slug: string): Promise<DynamicTab | undefined> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query("SELECT * FROM app_tabs WHERE slug = $1", [slug]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return parseTabRow(mapPgRow(row));
  }

  if (!sqliteDb) return undefined;
  const row = sqliteDb.prepare("SELECT * FROM app_tabs WHERE slug = ?").get(slug) as TabRow | undefined;
  if (!row) return undefined;
  return parseTabRow(row);
}

export async function createTab(input: {
  slug: string;
  title: string;
  subtitle?: string;
  icon?: string;
  createdBy: string;
  config?: DynamicTabConfig;
  groupIds?: string[];
}): Promise<DynamicTab | undefined> {
  const now = nowIso();
  const id = `tab_${Date.now()}`;
  const config = input.config ?? DEFAULT_TAB_CONFIG;

  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query(
      "INSERT INTO app_tabs (id, slug, title, subtitle, icon, enabled, isSystem, createdBy, configJson, createdAt, updatedAt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
      [
        id,
        input.slug,
        input.title,
        input.subtitle ?? null,
        input.icon ?? null,
        1,
        0,
        input.createdBy,
        JSON.stringify(config),
        now,
        now,
      ]
    );

    if (input.groupIds && input.groupIds.length > 0) {
      for (const groupId of input.groupIds) {
        await pgPool.query(
          "INSERT INTO app_tab_group_visibility (tabId, groupId, createdAt) VALUES ($1,$2,$3) ON CONFLICT (tabId, groupId) DO NOTHING",
          [id, groupId, now]
        );
      }
    }

    return getTabById(id);
  }

  if (!sqliteDb) return undefined;

  sqliteDb.prepare(
    "INSERT INTO app_tabs (id, slug, title, subtitle, icon, enabled, isSystem, createdBy, configJson, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
  ).run(
    id,
    input.slug,
    input.title,
    input.subtitle ?? null,
    input.icon ?? null,
    1,
    0,
    input.createdBy,
    JSON.stringify(config),
    now,
    now
  );

  if (input.groupIds && input.groupIds.length > 0) {
    const stmt = sqliteDb.prepare(
      "INSERT OR IGNORE INTO app_tab_group_visibility (tabId, groupId, createdAt) VALUES (?,?,?)"
    );
    for (const groupId of input.groupIds) {
      stmt.run(id, groupId, now);
    }
  }

  return getTabById(id);
}

export async function updateTab(id: string, patch: Partial<DynamicTab> & { groupIds?: string[] }): Promise<DynamicTab | undefined> {
  const existing = await getTabById(id);
  if (!existing) return undefined;

  const next = {
    ...existing,
    ...patch,
    config: patch.config ?? existing.config,
    updatedAt: nowIso(),
  };

  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query(
      "UPDATE app_tabs SET slug = $1, title = $2, subtitle = $3, icon = $4, enabled = $5, configJson = $6, updatedAt = $7 WHERE id = $8",
      [
        next.slug,
        next.title,
        next.subtitle ?? null,
        next.icon ?? null,
        next.enabled ? 1 : 0,
        JSON.stringify(next.config),
        next.updatedAt,
        id,
      ]
    );

    if (patch.groupIds) {
      await pgPool.query("DELETE FROM app_tab_group_visibility WHERE tabId = $1", [id]);
      for (const groupId of patch.groupIds) {
        await pgPool.query(
          "INSERT INTO app_tab_group_visibility (tabId, groupId, createdAt) VALUES ($1,$2,$3) ON CONFLICT (tabId, groupId) DO NOTHING",
          [id, groupId, nowIso()]
        );
      }
    }

    return getTabById(id);
  }

  if (!sqliteDb) return undefined;

  sqliteDb.prepare(
    "UPDATE app_tabs SET slug = ?, title = ?, subtitle = ?, icon = ?, enabled = ?, configJson = ?, updatedAt = ? WHERE id = ?"
  ).run(
    next.slug,
    next.title,
    next.subtitle ?? null,
    next.icon ?? null,
    next.enabled ? 1 : 0,
    JSON.stringify(next.config),
    next.updatedAt,
    id
  );

  if (patch.groupIds) {
    sqliteDb.prepare("DELETE FROM app_tab_group_visibility WHERE tabId = ?").run(id);
    const stmt = sqliteDb.prepare(
      "INSERT OR IGNORE INTO app_tab_group_visibility (tabId, groupId, createdAt) VALUES (?,?,?)"
    );
    for (const groupId of patch.groupIds) {
      stmt.run(id, groupId, nowIso());
    }
  }

  return getTabById(id);
}

export async function deleteTab(id: string): Promise<void> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query("DELETE FROM app_tab_group_visibility WHERE tabId = $1", [id]);
    await pgPool.query("DELETE FROM app_tabs WHERE id = $1", [id]);
    return;
  }

  if (!sqliteDb) return;
  sqliteDb.prepare("DELETE FROM app_tab_group_visibility WHERE tabId = ?").run(id);
  sqliteDb.prepare("DELETE FROM app_tabs WHERE id = ?").run(id);
}

async function getVisibleTabIdsForGroup(groupId: string): Promise<string[]> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query("SELECT tabId FROM app_tab_group_visibility WHERE groupId = $1", [groupId]);
    return result.rows.map((row) => String((row as Record<string, unknown>).tabid ?? (row as Record<string, unknown>).tabId ?? ""));
  }

  if (!sqliteDb) return [];
  const rows = sqliteDb
    .prepare("SELECT tabId FROM app_tab_group_visibility WHERE groupId = ?")
    .all(groupId) as Array<{ tabId: string }>;
  return rows.map((row) => row.tabId);
}

async function getTabIdsWithVisibilityRules(): Promise<Set<string>> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query("SELECT DISTINCT tabId FROM app_tab_group_visibility");
    return new Set(
      result.rows.map((row) => String((row as Record<string, unknown>).tabid ?? (row as Record<string, unknown>).tabId ?? ""))
    );
  }

  if (!sqliteDb) return new Set();
  const rows = sqliteDb.prepare("SELECT DISTINCT tabId FROM app_tab_group_visibility").all() as Array<{ tabId: string }>;
  return new Set(rows.map((row) => row.tabId));
}

export async function getTabsForGroup(groupId: string): Promise<DynamicTab[]> {
  const allTabs = (await getAllTabs()).filter((tab) => tab.enabled);
  const visibleIds = new Set(await getVisibleTabIdsForGroup(groupId));
  const restrictedTabIds = await getTabIdsWithVisibilityRules();

  return allTabs.filter((tab) => {
    if (!restrictedTabIds.has(tab.id)) return true;
    return visibleIds.has(tab.id);
  });
}

export async function getGroupIdsForTab(tabId: string): Promise<string[]> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query(
      "SELECT groupId FROM app_tab_group_visibility WHERE tabId = $1 ORDER BY groupId ASC",
      [tabId]
    );
    return result.rows.map((row) => String((row as Record<string, unknown>).groupid ?? (row as Record<string, unknown>).groupId ?? ""));
  }

  if (!sqliteDb) return [];
  const rows = sqliteDb
    .prepare("SELECT groupId FROM app_tab_group_visibility WHERE tabId = ? ORDER BY groupId ASC")
    .all(tabId) as Array<{ groupId: string }>;

  return rows.map((row) => row.groupId);
}
