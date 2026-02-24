import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import type {
  AccountGroupMembership,
  IpAllowlistEntry,
  SecuritySettings,
  UserGroup,
} from "@/lib/types";

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "accounts.db");
const db = new Database(dbPath);

// Security + IAM tables
 db.exec(`
CREATE TABLE IF NOT EXISTS user_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  isDefault INTEGER DEFAULT 0,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS account_group_memberships (
  accountId TEXT PRIMARY KEY,
  groupId TEXT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS security_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS ip_allowlist_entries (
  id TEXT PRIMARY KEY,
  ipOrCidr TEXT NOT NULL,
  label TEXT,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT,
  updatedAt TEXT
);
`);

const nowIso = () => new Date().toISOString();

function ensureDefaults() {
  const countGroups = db.prepare("SELECT COUNT(*) as c FROM user_groups").get() as { c: number };
  if (countGroups.c === 0) {
    const now = nowIso();
    db.prepare(
      "INSERT INTO user_groups (id,name,description,isDefault,createdAt,updatedAt) VALUES (?,?,?,?,?,?)"
    ).run("g_default_ops", "Operators", "Default operator group", 1, now, now);
  }

  const ipSetting = db
    .prepare("SELECT value FROM security_settings WHERE key = 'ipAllowlistEnabled'")
    .get() as { value?: string } | undefined;
  if (!ipSetting) {
    db.prepare("INSERT INTO security_settings (key, value, updatedAt) VALUES (?,?,?)").run(
      "ipAllowlistEnabled",
      "0",
      nowIso()
    );
  }
}

ensureDefaults();

export function getUserGroups(): UserGroup[] {
  const rows = db
    .prepare("SELECT * FROM user_groups ORDER BY isDefault DESC, name ASC")
    .all() as Array<{
      id: string;
      name: string;
      description?: string | null;
      isDefault: number;
      createdAt: string;
      updatedAt: string;
    }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    isDefault: row.isDefault === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export function createUserGroup(input: Pick<UserGroup, "name"> & Partial<UserGroup>) {
  const now = nowIso();
  const id = input.id ?? `g_${Date.now()}`;
  db.prepare(
    "INSERT INTO user_groups (id,name,description,isDefault,createdAt,updatedAt) VALUES (?,?,?,?,?,?)"
  ).run(id, input.name, input.description ?? null, input.isDefault ? 1 : 0, now, now);
  return getUserGroups().find((g) => g.id === id);
}

export function updateUserGroup(id: string, patch: Partial<UserGroup>) {
  const existing = db.prepare("SELECT * FROM user_groups WHERE id = ?").get(id) as
    | {
        id: string;
        name: string;
        description?: string | null;
        isDefault: number;
      }
    | undefined;
  if (!existing) return undefined;

  const nextName = patch.name ?? existing.name;
  const nextDescription = patch.description ?? existing.description ?? null;
  const nextIsDefault = patch.isDefault ?? (existing.isDefault === 1);

  db.prepare(
    "UPDATE user_groups SET name = ?, description = ?, isDefault = ?, updatedAt = ? WHERE id = ?"
  ).run(nextName, nextDescription, nextIsDefault ? 1 : 0, nowIso(), id);

  return getUserGroups().find((g) => g.id === id);
}

export function deleteUserGroup(id: string) {
  db.prepare("DELETE FROM user_groups WHERE id = ?").run(id);
  db.prepare("DELETE FROM account_group_memberships WHERE groupId = ?").run(id);
}

export function getAccountGroupMemberships(): AccountGroupMembership[] {
  const rows = db
    .prepare("SELECT * FROM account_group_memberships ORDER BY updatedAt DESC")
    .all() as Array<{ accountId: string; groupId: string; createdAt: string; updatedAt: string }>;

  return rows;
}

export function setAccountGroupMembership(accountId: string, groupId: string) {
  const now = nowIso();
  const existing = db
    .prepare("SELECT accountId FROM account_group_memberships WHERE accountId = ?")
    .get(accountId) as { accountId: string } | undefined;

  if (existing) {
    db.prepare("UPDATE account_group_memberships SET groupId = ?, updatedAt = ? WHERE accountId = ?").run(
      groupId,
      now,
      accountId
    );
  } else {
    db.prepare(
      "INSERT INTO account_group_memberships (accountId,groupId,createdAt,updatedAt) VALUES (?,?,?,?)"
    ).run(accountId, groupId, now, now);
  }

  return db
    .prepare("SELECT * FROM account_group_memberships WHERE accountId = ?")
    .get(accountId) as AccountGroupMembership;
}

export function getDefaultGroupId(): string | null {
  const row = db
    .prepare("SELECT id FROM user_groups WHERE isDefault = 1 ORDER BY createdAt ASC LIMIT 1")
    .get() as { id?: string } | undefined;
  return row?.id ?? null;
}

export function getGroupIdForAccount(accountId: string): string | null {
  const row = db
    .prepare("SELECT groupId FROM account_group_memberships WHERE accountId = ?")
    .get(accountId) as { groupId?: string } | undefined;
  if (row?.groupId) return row.groupId;
  return getDefaultGroupId();
}

export function getSecuritySettings(): SecuritySettings {
  const row = db
    .prepare("SELECT value FROM security_settings WHERE key = 'ipAllowlistEnabled'")
    .get() as { value?: string } | undefined;

  return {
    ipAllowlistEnabled: row?.value === "1",
  };
}

export function updateSecuritySettings(patch: Partial<SecuritySettings>) {
  if (patch.ipAllowlistEnabled !== undefined) {
    db.prepare("UPDATE security_settings SET value = ?, updatedAt = ? WHERE key = 'ipAllowlistEnabled'").run(
      patch.ipAllowlistEnabled ? "1" : "0",
      nowIso()
    );
  }
  return getSecuritySettings();
}

export function getIpAllowlistEntries(): IpAllowlistEntry[] {
  const rows = db
    .prepare("SELECT * FROM ip_allowlist_entries ORDER BY updatedAt DESC")
    .all() as Array<{
      id: string;
      ipOrCidr: string;
      label?: string | null;
      isActive: number;
      createdAt: string;
      updatedAt: string;
    }>;

  return rows.map((row) => ({
    id: row.id,
    ipOrCidr: row.ipOrCidr,
    label: row.label ?? undefined,
    isActive: row.isActive === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export function addIpAllowlistEntry(entry: Pick<IpAllowlistEntry, "ipOrCidr"> & Partial<IpAllowlistEntry>) {
  const now = nowIso();
  const id = entry.id ?? `ip_${Date.now()}`;

  db.prepare(
    "INSERT INTO ip_allowlist_entries (id, ipOrCidr, label, isActive, createdAt, updatedAt) VALUES (?,?,?,?,?,?)"
  ).run(id, entry.ipOrCidr, entry.label ?? null, entry.isActive === false ? 0 : 1, now, now);

  return getIpAllowlistEntries().find((item) => item.id === id);
}

export function updateIpAllowlistEntry(id: string, patch: Partial<IpAllowlistEntry>) {
  const existing = db.prepare("SELECT * FROM ip_allowlist_entries WHERE id = ?").get(id) as
    | {
        id: string;
        ipOrCidr: string;
        label?: string | null;
        isActive: number;
      }
    | undefined;
  if (!existing) return undefined;

  db.prepare(
    "UPDATE ip_allowlist_entries SET ipOrCidr = ?, label = ?, isActive = ?, updatedAt = ? WHERE id = ?"
  ).run(
    patch.ipOrCidr ?? existing.ipOrCidr,
    patch.label ?? existing.label ?? null,
    patch.isActive !== undefined ? (patch.isActive ? 1 : 0) : existing.isActive,
    nowIso(),
    id
  );

  return getIpAllowlistEntries().find((entry) => entry.id === id);
}

export function deleteIpAllowlistEntry(id: string) {
  db.prepare("DELETE FROM ip_allowlist_entries WHERE id = ?").run(id);
}
