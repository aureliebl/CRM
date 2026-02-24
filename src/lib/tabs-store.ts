import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import type { DynamicTab, DynamicTabConfig } from "@/lib/types";

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "accounts.db");
const db = new Database(dbPath);

db.exec(`
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

export function getAllTabs(): DynamicTab[] {
  const rows = db
    .prepare("SELECT * FROM app_tabs ORDER BY isSystem DESC, createdAt ASC")
    .all() as TabRow[];
  return rows.map(parseTabRow);
}

export function getTabById(id: string): DynamicTab | undefined {
  const row = db.prepare("SELECT * FROM app_tabs WHERE id = ?").get(id) as TabRow | undefined;
  if (!row) return undefined;
  return parseTabRow(row);
}

export function getTabBySlug(slug: string): DynamicTab | undefined {
  const row = db.prepare("SELECT * FROM app_tabs WHERE slug = ?").get(slug) as TabRow | undefined;
  if (!row) return undefined;
  return parseTabRow(row);
}

export function createTab(input: {
  slug: string;
  title: string;
  subtitle?: string;
  icon?: string;
  createdBy: string;
  config?: DynamicTabConfig;
  groupIds?: string[];
}) {
  const now = nowIso();
  const id = `tab_${Date.now()}`;
  const config = input.config ?? DEFAULT_TAB_CONFIG;

  db.prepare(
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
    const stmt = db.prepare(
      "INSERT OR IGNORE INTO app_tab_group_visibility (tabId, groupId, createdAt) VALUES (?,?,?)"
    );
    for (const groupId of input.groupIds) {
      stmt.run(id, groupId, now);
    }
  }

  return getTabById(id);
}

export function updateTab(id: string, patch: Partial<DynamicTab> & { groupIds?: string[] }) {
  const existing = getTabById(id);
  if (!existing) return undefined;

  const next = {
    ...existing,
    ...patch,
    config: patch.config ?? existing.config,
    updatedAt: nowIso(),
  };

  db.prepare(
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
    db.prepare("DELETE FROM app_tab_group_visibility WHERE tabId = ?").run(id);
    const stmt = db.prepare(
      "INSERT OR IGNORE INTO app_tab_group_visibility (tabId, groupId, createdAt) VALUES (?,?,?)"
    );
    for (const groupId of patch.groupIds) {
      stmt.run(id, groupId, nowIso());
    }
  }

  return getTabById(id);
}

export function deleteTab(id: string) {
  db.prepare("DELETE FROM app_tab_group_visibility WHERE tabId = ?").run(id);
  db.prepare("DELETE FROM app_tabs WHERE id = ?").run(id);
}

function getVisibleTabIdsForGroup(groupId: string): string[] {
  const rows = db
    .prepare("SELECT tabId FROM app_tab_group_visibility WHERE groupId = ?")
    .all(groupId) as Array<{ tabId: string }>;
  return rows.map((row) => row.tabId);
}

function getTabIdsWithVisibilityRules(): Set<string> {
  const rows = db.prepare("SELECT DISTINCT tabId FROM app_tab_group_visibility").all() as Array<{ tabId: string }>;
  return new Set(rows.map((row) => row.tabId));
}

export function getTabsForGroup(groupId: string): DynamicTab[] {
  const allTabs = getAllTabs().filter((tab) => tab.enabled);
  const visibleIds = new Set(getVisibleTabIdsForGroup(groupId));
  const restrictedTabIds = getTabIdsWithVisibilityRules();

  return allTabs.filter((tab) => {
    if (!restrictedTabIds.has(tab.id)) return true;
    return visibleIds.has(tab.id);
  });
}

export function getGroupIdsForTab(tabId: string): string[] {
  const rows = db
    .prepare("SELECT groupId FROM app_tab_group_visibility WHERE tabId = ? ORDER BY groupId ASC")
    .all(tabId) as Array<{ groupId: string }>;

  return rows.map((row) => row.groupId);
}
