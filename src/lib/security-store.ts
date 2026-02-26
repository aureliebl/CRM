import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import { Pool } from "pg";
import type {
  AccountGroupMembership,
  IpAllowlistEntry,
  SecuritySettings,
  UserGroup,
} from "@/lib/types";

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

// Security + IAM tables
if (sqliteDb) {
 sqliteDb.exec(`
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
}

const nowIso = () => new Date().toISOString();

async function ensurePostgresSchema() {
  if (!pgPool) return;

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS user_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      isDefault INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS account_group_memberships (
      accountId TEXT PRIMARY KEY,
      groupId TEXT NOT NULL,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS security_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updatedAt TEXT
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS ip_allowlist_entries (
      id TEXT PRIMARY KEY,
      ipOrCidr TEXT NOT NULL,
      label TEXT,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);
}

async function ensureDefaultsPostgres() {
  if (!pgPool) return;

  const countRes = await pgPool.query("SELECT COUNT(*)::int as c FROM user_groups");
  const countGroups = Number(countRes.rows[0]?.c ?? 0);
  if (countGroups === 0) {
    const now = nowIso();
    await pgPool.query(
      "INSERT INTO user_groups (id,name,description,isDefault,createdAt,updatedAt) VALUES ($1,$2,$3,$4,$5,$6)",
      ["g_default_ops", "Operators", "Default operator group", 1, now, now]
    );
  }

  const ipSetting = await pgPool.query("SELECT value FROM security_settings WHERE key = 'ipAllowlistEnabled'");
  if (!ipSetting.rows[0]) {
    await pgPool.query(
      "INSERT INTO security_settings (key, value, updatedAt) VALUES ($1,$2,$3)",
      ["ipAllowlistEnabled", "0", nowIso()]
    );
  }
}

async function ensurePostgresReady() {
  if (!usePostgres || !pgPool) return;
  if (!postgresReady) {
    postgresReady = (async () => {
      await ensurePostgresSchema();
      await ensureDefaultsPostgres();
    })();
  }
  await postgresReady;
}

function ensureDefaults() {
  if (!sqliteDb) return;

  const countGroups = sqliteDb.prepare("SELECT COUNT(*) as c FROM user_groups").get() as { c: number };
  if (countGroups.c === 0) {
    const now = nowIso();
    sqliteDb.prepare(
      "INSERT INTO user_groups (id,name,description,isDefault,createdAt,updatedAt) VALUES (?,?,?,?,?,?)"
    ).run("g_default_ops", "Operators", "Default operator group", 1, now, now);
  }

  const ipSetting = sqliteDb
    .prepare("SELECT value FROM security_settings WHERE key = 'ipAllowlistEnabled'")
    .get() as { value?: string } | undefined;
  if (!ipSetting) {
    sqliteDb.prepare("INSERT INTO security_settings (key, value, updatedAt) VALUES (?,?,?)").run(
      "ipAllowlistEnabled",
      "0",
      nowIso()
    );
  }
}

ensureDefaults();

export async function getUserGroups(): Promise<UserGroup[]> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query("SELECT * FROM user_groups ORDER BY isDefault DESC, name ASC");
    return result.rows.map((row) => ({
      id: String((row as Record<string, unknown>).id ?? ""),
      name: String((row as Record<string, unknown>).name ?? ""),
      description: ((row as Record<string, unknown>).description as string | null | undefined) ?? undefined,
      isDefault: Number((row as Record<string, unknown>).isdefault ?? (row as Record<string, unknown>).isDefault ?? 0) === 1,
      createdAt: String((row as Record<string, unknown>).createdat ?? (row as Record<string, unknown>).createdAt ?? ""),
      updatedAt: String((row as Record<string, unknown>).updatedat ?? (row as Record<string, unknown>).updatedAt ?? ""),
    }));
  }

  if (!sqliteDb) return [];
  const rows = sqliteDb
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

export async function createUserGroup(input: Pick<UserGroup, "name"> & Partial<UserGroup>) {
  const now = nowIso();
  const id = input.id ?? `g_${Date.now()}`;

  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query(
      "INSERT INTO user_groups (id,name,description,isDefault,createdAt,updatedAt) VALUES ($1,$2,$3,$4,$5,$6)",
      [id, input.name, input.description ?? null, input.isDefault ? 1 : 0, now, now]
    );
    return (await getUserGroups()).find((g) => g.id === id);
  }

  if (!sqliteDb) return undefined;
  sqliteDb.prepare(
    "INSERT INTO user_groups (id,name,description,isDefault,createdAt,updatedAt) VALUES (?,?,?,?,?,?)"
  ).run(id, input.name, input.description ?? null, input.isDefault ? 1 : 0, now, now);
  return (await getUserGroups()).find((g) => g.id === id);
}

export async function updateUserGroup(id: string, patch: Partial<UserGroup>) {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const existingResult = await pgPool.query("SELECT * FROM user_groups WHERE id = $1", [id]);
    const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
    if (!existing) return undefined;

    const nextName = patch.name ?? String(existing.name ?? "");
    const nextDescription = patch.description ?? (existing.description as string | null | undefined) ?? null;
    const nextIsDefault = patch.isDefault ?? (Number(existing.isdefault ?? existing.isDefault ?? 0) === 1);

    await pgPool.query(
      "UPDATE user_groups SET name = $1, description = $2, isDefault = $3, updatedAt = $4 WHERE id = $5",
      [nextName, nextDescription, nextIsDefault ? 1 : 0, nowIso(), id]
    );

    return (await getUserGroups()).find((g) => g.id === id);
  }

  if (!sqliteDb) return undefined;

  const existing = sqliteDb.prepare("SELECT * FROM user_groups WHERE id = ?").get(id) as
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

  sqliteDb.prepare(
    "UPDATE user_groups SET name = ?, description = ?, isDefault = ?, updatedAt = ? WHERE id = ?"
  ).run(nextName, nextDescription, nextIsDefault ? 1 : 0, nowIso(), id);

  return (await getUserGroups()).find((g) => g.id === id);
}

export async function deleteUserGroup(id: string) {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query("DELETE FROM user_groups WHERE id = $1", [id]);
    await pgPool.query("DELETE FROM account_group_memberships WHERE groupId = $1", [id]);
    return;
  }

  if (!sqliteDb) return;
  sqliteDb.prepare("DELETE FROM user_groups WHERE id = ?").run(id);
  sqliteDb.prepare("DELETE FROM account_group_memberships WHERE groupId = ?").run(id);
}

export async function getAccountGroupMemberships(): Promise<AccountGroupMembership[]> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query("SELECT * FROM account_group_memberships ORDER BY updatedAt DESC");
    return result.rows.map((row) => ({
      accountId: String((row as Record<string, unknown>).accountid ?? (row as Record<string, unknown>).accountId ?? ""),
      groupId: String((row as Record<string, unknown>).groupid ?? (row as Record<string, unknown>).groupId ?? ""),
      createdAt: String((row as Record<string, unknown>).createdat ?? (row as Record<string, unknown>).createdAt ?? ""),
      updatedAt: String((row as Record<string, unknown>).updatedat ?? (row as Record<string, unknown>).updatedAt ?? ""),
    }));
  }

  if (!sqliteDb) return [];
  const rows = sqliteDb
    .prepare("SELECT * FROM account_group_memberships ORDER BY updatedAt DESC")
    .all() as Array<{ accountId: string; groupId: string; createdAt: string; updatedAt: string }>;

  return rows;
}

export async function setAccountGroupMembership(accountId: string, groupId: string) {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const now = nowIso();
    await pgPool.query(
      "INSERT INTO account_group_memberships (accountId,groupId,createdAt,updatedAt) VALUES ($1,$2,$3,$4) ON CONFLICT (accountId) DO UPDATE SET groupId = EXCLUDED.groupId, updatedAt = EXCLUDED.updatedAt",
      [accountId, groupId, now, now]
    );

    const result = await pgPool.query(
      "SELECT * FROM account_group_memberships WHERE accountId = $1",
      [accountId]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      accountId: String(row.accountid ?? row.accountId ?? ""),
      groupId: String(row.groupid ?? row.groupId ?? ""),
      createdAt: String(row.createdat ?? row.createdAt ?? ""),
      updatedAt: String(row.updatedat ?? row.updatedAt ?? ""),
    } as AccountGroupMembership;
  }

  if (!sqliteDb) return undefined;

  const now = nowIso();
  const existing = sqliteDb
    .prepare("SELECT accountId FROM account_group_memberships WHERE accountId = ?")
    .get(accountId) as { accountId: string } | undefined;

  if (existing) {
    sqliteDb.prepare("UPDATE account_group_memberships SET groupId = ?, updatedAt = ? WHERE accountId = ?").run(
      groupId,
      now,
      accountId
    );
  } else {
    sqliteDb.prepare(
      "INSERT INTO account_group_memberships (accountId,groupId,createdAt,updatedAt) VALUES (?,?,?,?)"
    ).run(accountId, groupId, now, now);
  }

  return sqliteDb
    .prepare("SELECT * FROM account_group_memberships WHERE accountId = ?")
    .get(accountId) as AccountGroupMembership;
}

export async function getDefaultGroupId(): Promise<string | null> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query(
      "SELECT id FROM user_groups WHERE isDefault = 1 ORDER BY createdAt ASC LIMIT 1"
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row?.id ? String(row.id) : null;
  }

  if (!sqliteDb) return null;
  const row = sqliteDb
    .prepare("SELECT id FROM user_groups WHERE isDefault = 1 ORDER BY createdAt ASC LIMIT 1")
    .get() as { id?: string } | undefined;
  return row?.id ?? null;
}

export async function getGroupIdForAccount(accountId: string): Promise<string | null> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query(
      "SELECT groupId FROM account_group_memberships WHERE accountId = $1",
      [accountId]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (row?.groupid || row?.groupId) return String(row.groupid ?? row.groupId);
    return getDefaultGroupId();
  }

  if (!sqliteDb) return null;
  const row = sqliteDb
    .prepare("SELECT groupId FROM account_group_memberships WHERE accountId = ?")
    .get(accountId) as { groupId?: string } | undefined;
  if (row?.groupId) return row.groupId;
  return getDefaultGroupId();
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query("SELECT value FROM security_settings WHERE key = 'ipAllowlistEnabled'");
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return {
      ipAllowlistEnabled: String(row?.value ?? "0") === "1",
    };
  }

  if (!sqliteDb) {
    return {
      ipAllowlistEnabled: false,
    };
  }

  const row = sqliteDb
    .prepare("SELECT value FROM security_settings WHERE key = 'ipAllowlistEnabled'")
    .get() as { value?: string } | undefined;

  return {
    ipAllowlistEnabled: row?.value === "1",
  };
}

export async function updateSecuritySettings(patch: Partial<SecuritySettings>) {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    if (patch.ipAllowlistEnabled !== undefined) {
      await pgPool.query(
        "UPDATE security_settings SET value = $1, updatedAt = $2 WHERE key = 'ipAllowlistEnabled'",
        [patch.ipAllowlistEnabled ? "1" : "0", nowIso()]
      );
    }
    return getSecuritySettings();
  }

  if (!sqliteDb) return getSecuritySettings();

  if (patch.ipAllowlistEnabled !== undefined) {
    sqliteDb.prepare("UPDATE security_settings SET value = ?, updatedAt = ? WHERE key = 'ipAllowlistEnabled'").run(
      patch.ipAllowlistEnabled ? "1" : "0",
      nowIso()
    );
  }
  return getSecuritySettings();
}

export async function getIpAllowlistEntries(): Promise<IpAllowlistEntry[]> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query("SELECT * FROM ip_allowlist_entries ORDER BY updatedAt DESC");
    return result.rows.map((row) => ({
      id: String((row as Record<string, unknown>).id ?? ""),
      ipOrCidr: String((row as Record<string, unknown>).iporcidr ?? (row as Record<string, unknown>).ipOrCidr ?? ""),
      label: ((row as Record<string, unknown>).label as string | null | undefined) ?? undefined,
      isActive: Number((row as Record<string, unknown>).isactive ?? (row as Record<string, unknown>).isActive ?? 0) === 1,
      createdAt: String((row as Record<string, unknown>).createdat ?? (row as Record<string, unknown>).createdAt ?? ""),
      updatedAt: String((row as Record<string, unknown>).updatedat ?? (row as Record<string, unknown>).updatedAt ?? ""),
    }));
  }

  if (!sqliteDb) return [];
  const rows = sqliteDb
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

export async function addIpAllowlistEntry(entry: Pick<IpAllowlistEntry, "ipOrCidr"> & Partial<IpAllowlistEntry>) {
  const now = nowIso();
  const id = entry.id ?? `ip_${Date.now()}`;

  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query(
      "INSERT INTO ip_allowlist_entries (id, ipOrCidr, label, isActive, createdAt, updatedAt) VALUES ($1,$2,$3,$4,$5,$6)",
      [id, entry.ipOrCidr, entry.label ?? null, entry.isActive === false ? 0 : 1, now, now]
    );
    return (await getIpAllowlistEntries()).find((item) => item.id === id);
  }

  if (!sqliteDb) return undefined;

  sqliteDb.prepare(
    "INSERT INTO ip_allowlist_entries (id, ipOrCidr, label, isActive, createdAt, updatedAt) VALUES (?,?,?,?,?,?)"
  ).run(id, entry.ipOrCidr, entry.label ?? null, entry.isActive === false ? 0 : 1, now, now);

  return (await getIpAllowlistEntries()).find((item) => item.id === id);
}

export async function updateIpAllowlistEntry(id: string, patch: Partial<IpAllowlistEntry>) {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const existingResult = await pgPool.query("SELECT * FROM ip_allowlist_entries WHERE id = $1", [id]);
    const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
    if (!existing) return undefined;

    await pgPool.query(
      "UPDATE ip_allowlist_entries SET ipOrCidr = $1, label = $2, isActive = $3, updatedAt = $4 WHERE id = $5",
      [
        patch.ipOrCidr ?? String(existing.iporcidr ?? existing.ipOrCidr ?? ""),
        patch.label ?? ((existing.label as string | null | undefined) ?? null),
        patch.isActive !== undefined
          ? patch.isActive
            ? 1
            : 0
          : Number(existing.isactive ?? existing.isActive ?? 0),
        nowIso(),
        id,
      ]
    );

    return (await getIpAllowlistEntries()).find((entry) => entry.id === id);
  }

  if (!sqliteDb) return undefined;

  const existing = sqliteDb.prepare("SELECT * FROM ip_allowlist_entries WHERE id = ?").get(id) as
    | {
        id: string;
        ipOrCidr: string;
        label?: string | null;
        isActive: number;
      }
    | undefined;
  if (!existing) return undefined;

  sqliteDb.prepare(
    "UPDATE ip_allowlist_entries SET ipOrCidr = ?, label = ?, isActive = ?, updatedAt = ? WHERE id = ?"
  ).run(
    patch.ipOrCidr ?? existing.ipOrCidr,
    patch.label ?? existing.label ?? null,
    patch.isActive !== undefined ? (patch.isActive ? 1 : 0) : existing.isActive,
    nowIso(),
    id
  );

  return (await getIpAllowlistEntries()).find((entry) => entry.id === id);
}

export async function deleteIpAllowlistEntry(id: string) {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query("DELETE FROM ip_allowlist_entries WHERE id = $1", [id]);
    return;
  }

  if (!sqliteDb) return;
  sqliteDb.prepare("DELETE FROM ip_allowlist_entries WHERE id = ?").run(id);
}
