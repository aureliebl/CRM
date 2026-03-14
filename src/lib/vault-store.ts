import { getSharedPgPool } from "@/lib/pg-pool";
import { vaultEncrypt, vaultDecrypt, generateBackupCode } from "@/lib/vault-crypto";
import { getGroupIdForAccount } from "@/lib/security-store";
import { isAccountSuperAdmin } from "@/lib/server-permissions";
import crypto from "crypto";

/* ─────────── PG pool setup (same pattern as other stores) ─────────── */

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

async function ensurePostgresSchema() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS vault_entries (
      id TEXT PRIMARY KEY,
      service_name TEXT NOT NULL,
      service_url TEXT,
      encrypted_login TEXT NOT NULL,
      login_iv TEXT NOT NULL,
      login_auth_tag TEXT NOT NULL,
      encrypted_password TEXT NOT NULL,
      password_iv TEXT NOT NULL,
      password_auth_tag TEXT NOT NULL,
      encrypted_notes TEXT,
      notes_iv TEXT,
      notes_auth_tag TEXT,
      created_by TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS vault_totp (
      id TEXT PRIMARY KEY,
      vault_entry_id TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT 'TOTP principal',
      encrypted_secret TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      algorithm TEXT NOT NULL DEFAULT 'SHA1',
      digits INTEGER NOT NULL DEFAULT 6,
      period INTEGER NOT NULL DEFAULT 30,
      created_at TEXT
    )
  `);

  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_vault_totp_entry ON vault_totp(vault_entry_id)`);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS vault_entry_groups (
      vault_entry_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      PRIMARY KEY (vault_entry_id, group_id)
    )
  `);

  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_vault_entry_groups_group ON vault_entry_groups(group_id)`);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS vault_backup_codes (
      id TEXT PRIMARY KEY,
      vault_totp_id TEXT NOT NULL,
      encrypted_code TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      used_at TEXT
    )
  `);

  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_vault_backup_codes_totp ON vault_backup_codes(vault_totp_id)`);
}

async function ensurePostgresReady() {
  if (!postgresReady) postgresReady = ensurePostgresSchema();
  await postgresReady;
}

/* ─────────── Types ─────────── */

export interface VaultEntry {
  id: string;
  serviceName: string;
  serviceUrl: string | null;
  login: string;          // decrypted
  password: string;       // decrypted
  notes: string | null;   // decrypted
  groupIds: string[];
  hasTotp: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VaultEntryListItem {
  id: string;
  serviceName: string;
  serviceUrl: string | null;
  loginMasked: string;
  groupIds: string[];
  hasTotp: boolean;
  createdAt: string;
}

export interface VaultTotp {
  id: string;
  vaultEntryId: string;
  label: string;
  secret: string;         // decrypted
  algorithm: string;
  digits: number;
  period: number;
  createdAt: string;
}

export interface VaultBackupCode {
  id: string;
  code: string;           // decrypted
  used: boolean;
  usedAt: string | null;
}

/* ─────────── Helpers ─────────── */

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function maskLogin(login: string): string {
  if (login.length <= 4) return "****";
  const at = login.indexOf("@");
  if (at > 2) {
    return login.slice(0, 2) + "***" + login.slice(at);
  }
  return login.slice(0, 2) + "***" + login.slice(-2);
}

async function getGroupIdsForEntry(entryId: string): Promise<string[]> {
  const result = await pgPool.query(
    "SELECT group_id FROM vault_entry_groups WHERE vault_entry_id = $1",
    [entryId]
  );
  return result.rows.map((r: { group_id: string }) => r.group_id);
}

async function entryHasTotp(entryId: string): Promise<boolean> {
  const result = await pgPool.query(
    "SELECT 1 FROM vault_totp WHERE vault_entry_id = $1 LIMIT 1",
    [entryId]
  );
  return result.rows.length > 0;
}

/* ─────────── CRUD: Entries ─────────── */

type ActorLike = { id: string; email?: string | null; role?: string | null };

export async function getVaultEntriesForActor(
  actor: ActorLike
): Promise<VaultEntryListItem[]> {
  await ensurePostgresReady();

  let rows;

  if (isAccountSuperAdmin(actor)) {
    // super admin sees everything
    const result = await pgPool.query(
      "SELECT * FROM vault_entries ORDER BY service_name ASC"
    );
    rows = result.rows;
  } else {
    // get group for actor
    const groupId = await getGroupIdForAccount(actor.id);
    if (!groupId) return [];

    const result = await pgPool.query(
      `SELECT ve.* FROM vault_entries ve
       INNER JOIN vault_entry_groups veg ON veg.vault_entry_id = ve.id
       WHERE veg.group_id = $1
       ORDER BY ve.service_name ASC`,
      [groupId]
    );
    rows = result.rows;
  }

  const items: VaultEntryListItem[] = [];
  for (const row of rows) {
    const loginDecrypted = vaultDecrypt(
      row.encrypted_login,
      row.login_iv,
      row.login_auth_tag
    );
    items.push({
      id: String(row.id),
      serviceName: String(row.service_name ?? ""),
      serviceUrl: row.service_url ? String(row.service_url) : null,
      loginMasked: maskLogin(loginDecrypted),
      groupIds: await getGroupIdsForEntry(String(row.id)),
      hasTotp: await entryHasTotp(String(row.id)),
      createdAt: String(row.created_at ?? ""),
    });
  }

  return items;
}

export async function getVaultEntryById(entryId: string): Promise<VaultEntry | null> {
  await ensurePostgresReady();
  const result = await pgPool.query("SELECT * FROM vault_entries WHERE id = $1", [entryId]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: String(row.id),
    serviceName: String(row.service_name ?? ""),
    serviceUrl: row.service_url ? String(row.service_url) : null,
    login: vaultDecrypt(row.encrypted_login, row.login_iv, row.login_auth_tag),
    password: vaultDecrypt(row.encrypted_password, row.password_iv, row.password_auth_tag),
    notes: row.encrypted_notes
      ? vaultDecrypt(row.encrypted_notes, row.notes_iv, row.notes_auth_tag)
      : null,
    groupIds: await getGroupIdsForEntry(entryId),
    hasTotp: await entryHasTotp(entryId),
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function canActorAccessEntry(
  actor: ActorLike,
  entryId: string
): Promise<boolean> {
  if (isAccountSuperAdmin(actor)) return true;

  const groupId = await getGroupIdForAccount(actor.id);
  if (!groupId) return false;

  const result = await pgPool.query(
    "SELECT 1 FROM vault_entry_groups WHERE vault_entry_id = $1 AND group_id = $2",
    [entryId, groupId]
  );
  return result.rows.length > 0;
}

export async function createVaultEntry(input: {
  serviceName: string;
  serviceUrl?: string | null;
  login: string;
  password: string;
  notes?: string | null;
  groupIds: string[];
  createdBy: string;
}): Promise<VaultEntry> {
  await ensurePostgresReady();
  const id = genId("ve");
  const ts = now();

  const encLogin = vaultEncrypt(input.login);
  const encPassword = vaultEncrypt(input.password);
  const encNotes = input.notes ? vaultEncrypt(input.notes) : null;

  await pgPool.query(
    `INSERT INTO vault_entries (
      id, service_name, service_url,
      encrypted_login, login_iv, login_auth_tag,
      encrypted_password, password_iv, password_auth_tag,
      encrypted_notes, notes_iv, notes_auth_tag,
      created_by, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      id,
      input.serviceName,
      input.serviceUrl || null,
      encLogin.encrypted, encLogin.iv, encLogin.authTag,
      encPassword.encrypted, encPassword.iv, encPassword.authTag,
      encNotes?.encrypted || null, encNotes?.iv || null, encNotes?.authTag || null,
      input.createdBy,
      ts, ts,
    ]
  );

  // Insert group relations
  for (const gid of input.groupIds) {
    await pgPool.query(
      "INSERT INTO vault_entry_groups (vault_entry_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [id, gid]
    );
  }

  return {
    id,
    serviceName: input.serviceName,
    serviceUrl: input.serviceUrl || null,
    login: input.login,
    password: input.password,
    notes: input.notes || null,
    groupIds: input.groupIds,
    hasTotp: false,
    createdBy: input.createdBy,
    createdAt: ts,
    updatedAt: ts,
  };
}

export async function updateVaultEntry(
  id: string,
  patch: {
    serviceName?: string;
    serviceUrl?: string | null;
    login?: string;
    password?: string;
    notes?: string | null;
    groupIds?: string[];
  }
): Promise<void> {
  await ensurePostgresReady();
  const ts = now();

  // Build SET clauses dynamically
  const sets: string[] = ["updated_at = $1"];
  const params: unknown[] = [ts];
  let idx = 2;

  if (patch.serviceName !== undefined) {
    sets.push(`service_name = $${idx++}`);
    params.push(patch.serviceName);
  }
  if (patch.serviceUrl !== undefined) {
    sets.push(`service_url = $${idx++}`);
    params.push(patch.serviceUrl || null);
  }
  if (patch.login !== undefined) {
    const enc = vaultEncrypt(patch.login);
    sets.push(`encrypted_login = $${idx++}`);
    params.push(enc.encrypted);
    sets.push(`login_iv = $${idx++}`);
    params.push(enc.iv);
    sets.push(`login_auth_tag = $${idx++}`);
    params.push(enc.authTag);
  }
  if (patch.password !== undefined) {
    const enc = vaultEncrypt(patch.password);
    sets.push(`encrypted_password = $${idx++}`);
    params.push(enc.encrypted);
    sets.push(`password_iv = $${idx++}`);
    params.push(enc.iv);
    sets.push(`password_auth_tag = $${idx++}`);
    params.push(enc.authTag);
  }
  if (patch.notes !== undefined) {
    if (patch.notes) {
      const enc = vaultEncrypt(patch.notes);
      sets.push(`encrypted_notes = $${idx++}`);
      params.push(enc.encrypted);
      sets.push(`notes_iv = $${idx++}`);
      params.push(enc.iv);
      sets.push(`notes_auth_tag = $${idx++}`);
      params.push(enc.authTag);
    } else {
      sets.push(`encrypted_notes = $${idx++}`);
      params.push(null);
      sets.push(`notes_iv = $${idx++}`);
      params.push(null);
      sets.push(`notes_auth_tag = $${idx++}`);
      params.push(null);
    }
  }

  params.push(id);
  await pgPool.query(
    `UPDATE vault_entries SET ${sets.join(", ")} WHERE id = $${idx}`,
    params
  );

  // Update groups if provided
  if (patch.groupIds !== undefined) {
    await pgPool.query("DELETE FROM vault_entry_groups WHERE vault_entry_id = $1", [id]);
    for (const gid of patch.groupIds) {
      await pgPool.query(
        "INSERT INTO vault_entry_groups (vault_entry_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [id, gid]
      );
    }
  }
}

export async function deleteVaultEntry(id: string): Promise<void> {
  await ensurePostgresReady();

  // Get all TOTP IDs
  const totps = await pgPool.query("SELECT id FROM vault_totp WHERE vault_entry_id = $1", [id]);
  for (const t of totps.rows) {
    await pgPool.query("DELETE FROM vault_backup_codes WHERE vault_totp_id = $1", [t.id]);
  }

  await pgPool.query("DELETE FROM vault_totp WHERE vault_entry_id = $1", [id]);
  await pgPool.query("DELETE FROM vault_entry_groups WHERE vault_entry_id = $1", [id]);
  await pgPool.query("DELETE FROM vault_entries WHERE id = $1", [id]);
}

/* ─────────── TOTP ─────────── */

export async function addTotp(
  entryId: string,
  input: {
    label?: string;
    secret: string;     // base32 secret
    algorithm?: string;
    digits?: number;
    period?: number;
  }
): Promise<{ totp: VaultTotp; backupCodes: string[] }> {
  await ensurePostgresReady();
  const totpId = genId("vt");
  const ts = now();

  const encSecret = vaultEncrypt(input.secret);

  await pgPool.query(
    `INSERT INTO vault_totp (id, vault_entry_id, label, encrypted_secret, iv, auth_tag, algorithm, digits, period, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      totpId,
      entryId,
      input.label || "TOTP principal",
      encSecret.encrypted, encSecret.iv, encSecret.authTag,
      input.algorithm || "SHA1",
      input.digits || 6,
      input.period || 30,
      ts,
    ]
  );

  // Generate 10 backup codes
  const backupCodes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = generateBackupCode();
    backupCodes.push(code);
    const enc = vaultEncrypt(code);
    await pgPool.query(
      `INSERT INTO vault_backup_codes (id, vault_totp_id, encrypted_code, iv, auth_tag, used, used_at)
       VALUES ($1,$2,$3,$4,$5,0,NULL)`,
      [genId("vbc"), totpId, enc.encrypted, enc.iv, enc.authTag]
    );
  }

  return {
    totp: {
      id: totpId,
      vaultEntryId: entryId,
      label: input.label || "TOTP principal",
      secret: input.secret,
      algorithm: input.algorithm || "SHA1",
      digits: input.digits || 6,
      period: input.period || 30,
      createdAt: ts,
    },
    backupCodes,
  };
}

export async function getTotpForEntry(entryId: string): Promise<VaultTotp[]> {
  await ensurePostgresReady();
  const result = await pgPool.query(
    "SELECT * FROM vault_totp WHERE vault_entry_id = $1 ORDER BY created_at ASC",
    [entryId]
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    vaultEntryId: String(row.vault_entry_id),
    label: String(row.label ?? "TOTP"),
    secret: vaultDecrypt(String(row.encrypted_secret), String(row.iv), String(row.auth_tag)),
    algorithm: String(row.algorithm ?? "SHA1"),
    digits: Number(row.digits ?? 6),
    period: Number(row.period ?? 30),
    createdAt: String(row.created_at ?? ""),
  }));
}

export async function getBackupCodes(totpId: string): Promise<VaultBackupCode[]> {
  await ensurePostgresReady();
  const result = await pgPool.query(
    "SELECT * FROM vault_backup_codes WHERE vault_totp_id = $1 ORDER BY id ASC",
    [totpId]
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    code: vaultDecrypt(String(row.encrypted_code), String(row.iv), String(row.auth_tag)),
    used: Number(row.used) === 1,
    usedAt: row.used_at ? String(row.used_at) : null,
  }));
}

/* ─────────── Export (Super Admin) ─────────── */

export async function exportAllVaultEntries(): Promise<unknown[]> {
  await ensurePostgresReady();

  const entries = await pgPool.query("SELECT * FROM vault_entries ORDER BY service_name ASC");
  const exported: unknown[] = [];

  for (const row of entries.rows) {
    const id = String(row.id);
    const totps = await getTotpForEntry(id);
    const totpData = [];
    for (const totp of totps) {
      const codes = await getBackupCodes(totp.id);
      totpData.push({
        label: totp.label,
        secret: totp.secret,
        algorithm: totp.algorithm,
        digits: totp.digits,
        period: totp.period,
        backupCodes: codes.map((c) => ({ code: c.code, used: c.used })),
      });
    }

    exported.push({
      serviceName: String(row.service_name),
      serviceUrl: row.service_url ? String(row.service_url) : null,
      login: vaultDecrypt(row.encrypted_login, row.login_iv, row.login_auth_tag),
      password: vaultDecrypt(row.encrypted_password, row.password_iv, row.password_auth_tag),
      notes: row.encrypted_notes
        ? vaultDecrypt(row.encrypted_notes, row.notes_iv, row.notes_auth_tag)
        : null,
      groupIds: await getGroupIdsForEntry(id),
      totp: totpData,
    });
  }

  return exported;
}
