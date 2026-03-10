import { Pool } from "pg";
import { createHash, randomBytes } from "crypto";
import { hashPassword, verifyPassword } from "@/lib/password-hash";

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

const pgPoolMax = Math.max(1, Number(process.env.PGPOOL_MAX_CONNECTIONS || 1));
const pgPoolMin = Math.max(0, Number(process.env.PGPOOL_MIN_CONNECTIONS || 0));
const pgConnectionTimeoutMs = Math.max(
  1000,
  Number(process.env.PG_CONNECTION_TIMEOUT_MS || 15000)
);
const pgIdleTimeoutMs = Math.max(1000, Number(process.env.PG_IDLE_TIMEOUT_MS || 10000));

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

let postgresReady: Promise<void> | null = null;

if (sqliteDb) {
  sqliteDb.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT,
  firstName TEXT,
  lastName TEXT,
  fullName TEXT,
  role TEXT,
  isActive INTEGER DEFAULT 1,
  sessionVersion INTEGER DEFAULT 1,
  profileImage TEXT,
  locale TEXT DEFAULT 'fr',
  totpEnabled INTEGER DEFAULT 0,
  totpSecret TEXT,
  extras TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  accountId TEXT,
  type TEXT,
  message TEXT,
  timestamp TEXT
);

CREATE TABLE IF NOT EXISTS account_password_reset_tokens (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  tokenHash TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  createdBy TEXT,
  usedAt TEXT
);
`);
}

export type AccountRow = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName: string;
  role: string;
  isActive: number;
  sessionVersion: number;
  profileImage?: string | null;
  locale?: string | null;
  totpEnabled: number;
  totpSecret?: string | null;
  extras?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type SafeAccountRow = Omit<AccountRow, "totpSecret" | "extras">;

export type AuditLogRow = {
  id: string;
  accountId: string;
  type: string;
  message: string;
  timestamp: string;
};

export function toSafeAccount(row: AccountRow): SafeAccountRow {
  const { totpSecret: _totpSecret, extras: _extras, ...safe } = row;
  return safe;
}

function normalizeRole(role?: string | null): string {
  if (!role) return "operator";
  if (role === "admin" || role === "operator") return role;
  if (role === "sales" || role === "support") return "operator";
  return "operator";
}

function mapPgAccountRow(row: Record<string, unknown>): AccountRow {
  return {
    id: String(row.id ?? ""),
    email: String(row.email ?? ""),
    firstName: (row.firstname as string | null | undefined) ?? (row.firstName as string | null | undefined) ?? null,
    lastName: (row.lastname as string | null | undefined) ?? (row.lastName as string | null | undefined) ?? null,
    fullName: String((row.fullname ?? row.fullName ?? "") as string),
    role: normalizeRole((row.role as string | null | undefined) ?? null),
    isActive: Number((row.isactive ?? row.isActive ?? 1) as number),
    sessionVersion: Number((row.sessionversion ?? row.sessionVersion ?? 1) as number),
    profileImage:
      (row.profileimage as string | null | undefined) ?? (row.profileImage as string | null | undefined) ?? null,
    locale: ((row.locale as string | null | undefined) ?? "fr") || "fr",
    totpEnabled: Number((row.totpenabled ?? row.totpEnabled ?? 0) as number),
    totpSecret: (row.totpsecret as string | null | undefined) ?? (row.totpSecret as string | null | undefined) ?? null,
    extras: (row.extras as string | null | undefined) ?? null,
    createdAt: (row.createdat as string | null | undefined) ?? (row.createdAt as string | null | undefined) ?? null,
    updatedAt: (row.updatedat as string | null | undefined) ?? (row.updatedAt as string | null | undefined) ?? null,
  };
}

async function ensurePostgresSchema() {
  if (!pgPool) return;

  await pgPool.query(`
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT,
  firstName TEXT,
  lastName TEXT,
  fullName TEXT,
  role TEXT,
  isActive INTEGER DEFAULT 1,
  sessionVersion INTEGER DEFAULT 1,
  profileImage TEXT,
  locale TEXT DEFAULT 'fr',
  totpEnabled INTEGER DEFAULT 0,
  totpSecret TEXT,
  extras TEXT,
  createdAt TEXT,
  updatedAt TEXT
)
`);

  await pgPool.query("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS isActive INTEGER DEFAULT 1");
  await pgPool.query("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sessionVersion INTEGER DEFAULT 1");

  await pgPool.query(`
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  accountId TEXT,
  type TEXT,
  message TEXT,
  timestamp TEXT
)
`);

  await pgPool.query(`
CREATE TABLE IF NOT EXISTS account_credentials (
  accountId TEXT PRIMARY KEY,
  passwordHash TEXT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT
)
`);

  await pgPool.query(`
CREATE TABLE IF NOT EXISTS account_password_reset_tokens (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  tokenHash TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  createdBy TEXT,
  usedAt TEXT
)
`);

  await pgPool.query("CREATE INDEX IF NOT EXISTS idx_reset_tokens_hash ON account_password_reset_tokens(tokenHash)");
}

async function ensurePostgresReady() {
  if (!usePostgres || !pgPool) return;
  if (!postgresReady) {
    postgresReady = ensurePostgresSchema();
  }
  await postgresReady;
}

export async function getAllAccounts(): Promise<AccountRow[]> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query("SELECT * FROM accounts ORDER BY fullName ASC");
    return result.rows.map((row) => mapPgAccountRow(row as Record<string, unknown>));
  }

  if (!sqliteDb) return [];
  const stmt = sqliteDb.prepare("SELECT * FROM accounts ORDER BY fullName ASC");
  return stmt.all() as AccountRow[];
}

export async function getAccountById(id: string): Promise<AccountRow | undefined> {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query("SELECT * FROM accounts WHERE id = $1", [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return mapPgAccountRow(row);
  }

  if (!sqliteDb) return undefined;
  const stmt = sqliteDb.prepare("SELECT * FROM accounts WHERE id = ?");
  return stmt.get(id) as AccountRow | undefined;
}

export async function getAccountByEmail(email: string): Promise<AccountRow | undefined> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return undefined;

  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query("SELECT * FROM accounts WHERE LOWER(email) = $1 LIMIT 1", [normalized]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return mapPgAccountRow(row);
  }

  if (!sqliteDb) return undefined;
  const stmt = sqliteDb.prepare("SELECT * FROM accounts WHERE LOWER(email) = ? LIMIT 1");
  return stmt.get(normalized) as AccountRow | undefined;
}

function splitFullName(fullName?: string | null) {
  const normalized = (fullName ?? "").trim();
  if (!normalized) return { firstName: null, lastName: null };
  const parts = normalized.split(/\s+/);
  const firstName = parts.shift() ?? "";
  const lastName = parts.join(" ");
  return {
    firstName: firstName || null,
    lastName: lastName || null,
  };
}

function buildFullName(firstName?: string | null, lastName?: string | null, fallback?: string | null) {
  const merged = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return merged || fallback || null;
}

export async function createAccount(row: Partial<AccountRow>) {
  const now = new Date().toISOString();
  const id = row.id ?? `u_${Date.now()}`;
  const split = splitFullName(row.fullName);
  const firstName = row.firstName ?? split.firstName;
  const lastName = row.lastName ?? split.lastName;
  const fullName = buildFullName(firstName, lastName, row.fullName);

  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query(
      "INSERT INTO accounts (id,email,firstName,lastName,fullName,role,isActive,sessionVersion,profileImage,locale,totpEnabled,totpSecret,extras,createdAt,updatedAt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
      [
        id,
        row.email ?? null,
        firstName,
        lastName,
        fullName,
        normalizeRole(row.role),
        row.isActive ?? 1,
        row.sessionVersion ?? 1,
        row.profileImage ?? null,
        row.locale ?? "fr",
        row.totpEnabled ? 1 : 0,
        row.totpSecret ?? null,
        row.extras ?? null,
        now,
        now,
      ]
    );
    return getAccountById(id);
  }

  if (!sqliteDb) return undefined;

  const stmt = sqliteDb.prepare(
    "INSERT INTO accounts (id,email,firstName,lastName,fullName,role,isActive,sessionVersion,profileImage,locale,totpEnabled,totpSecret,extras,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  );
  stmt.run(
    id,
    row.email ?? null,
    firstName,
    lastName,
    fullName,
    normalizeRole(row.role),
    row.isActive ?? 1,
    row.sessionVersion ?? 1,
    row.profileImage ?? null,
    row.locale ?? "fr",
    row.totpEnabled ? 1 : 0,
    row.totpSecret ?? null,
    row.extras ?? null,
    now,
    now
  );
  return getAccountById(id);
}

export async function updateAccount(id: string, patch: Partial<AccountRow>) {
  const existing = await getAccountById(id);
  if (!existing) return undefined;

  const patchSplit = splitFullName(patch.fullName);
  const nextFirstName =
    patch.firstName !== undefined
      ? patch.firstName
      : patch.fullName !== undefined
      ? patchSplit.firstName
      : existing.firstName;
  const nextLastName =
    patch.lastName !== undefined
      ? patch.lastName
      : patch.fullName !== undefined
      ? patchSplit.lastName
      : existing.lastName;
  const nextFullName = buildFullName(
    nextFirstName,
    nextLastName,
    patch.fullName ?? existing.fullName
  );

  const updated = {
    ...existing,
    ...patch,
    firstName: nextFirstName,
    lastName: nextLastName,
    fullName: nextFullName,
    role: normalizeRole(patch.role ?? existing.role),
    isActive: patch.isActive ?? existing.isActive,
    sessionVersion: patch.sessionVersion ?? existing.sessionVersion,
    updatedAt: new Date().toISOString(),
  };
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query(
      "UPDATE accounts SET email = $1, firstName = $2, lastName = $3, fullName = $4, role = $5, isActive = $6, sessionVersion = $7, profileImage = $8, locale = $9, totpEnabled = $10, totpSecret = $11, extras = $12, updatedAt = $13 WHERE id = $14",
      [
        updated.email ?? null,
        updated.firstName ?? null,
        updated.lastName ?? null,
        updated.fullName ?? null,
        normalizeRole(updated.role) ?? null,
        updated.isActive ?? 1,
        updated.sessionVersion ?? 1,
        updated.profileImage ?? null,
        updated.locale ?? "fr",
        updated.totpEnabled ?? 0,
        updated.totpSecret ?? null,
        updated.extras ?? null,
        updated.updatedAt,
        id,
      ]
    );
    return getAccountById(id);
  }

  if (!sqliteDb) return undefined;

  const stmt = sqliteDb.prepare(
    "UPDATE accounts SET email = ?, firstName = ?, lastName = ?, fullName = ?, role = ?, isActive = ?, sessionVersion = ?, profileImage = ?, locale = ?, totpEnabled = ?, totpSecret = ?, extras = ?, updatedAt = ? WHERE id = ?"
  );
  stmt.run(
    updated.email ?? null,
    updated.firstName ?? null,
    updated.lastName ?? null,
    updated.fullName ?? null,
    normalizeRole(updated.role) ?? null,
    updated.isActive ?? 1,
    updated.sessionVersion ?? 1,
    updated.profileImage ?? null,
    updated.locale ?? "fr",
    updated.totpEnabled ?? 0,
    updated.totpSecret ?? null,
    updated.extras ?? null,
    updated.updatedAt,
    id
  );
  return getAccountById(id);
}

export async function deleteAccount(id: string) {
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query("DELETE FROM account_password_reset_tokens WHERE accountId = $1", [id]);
    await pgPool.query("DELETE FROM account_credentials WHERE accountId = $1", [id]);
    await pgPool.query("DELETE FROM accounts WHERE id = $1", [id]);
    return;
  }

  if (!sqliteDb) return;
  const stmt = sqliteDb.prepare("DELETE FROM accounts WHERE id = ?");
  stmt.run(id);
}

export async function addLog(accountId: string, type: string, message: string) {
  const id = `log_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const timestamp = new Date().toISOString();

  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query("INSERT INTO logs (id,accountId,type,message,timestamp) VALUES ($1,$2,$3,$4,$5)", [
      id,
      accountId,
      type,
      message,
      timestamp,
    ]);
    return { id, accountId, type, message, timestamp };
  }

  if (!sqliteDb) return { id, accountId, type, message, timestamp };

  const stmt = sqliteDb.prepare("INSERT INTO logs (id,accountId,type,message,timestamp) VALUES (?,?,?,?,?)");
  stmt.run(id, accountId, type, message, timestamp);
  return { id, accountId, type, message, timestamp };
}

export async function getRecentLogs(limit = 50): Promise<AuditLogRow[]> {
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));

  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query("SELECT id, accountId, type, message, timestamp FROM logs ORDER BY timestamp DESC LIMIT $1", [
      safeLimit,
    ]);
    return result.rows.map((row) => ({
      id: String(row.id ?? ""),
      accountId: String(row.accountid ?? row.accountId ?? ""),
      type: String(row.type ?? ""),
      message: String(row.message ?? ""),
      timestamp: String(row.timestamp ?? ""),
    }));
  }

  if (!sqliteDb) return [];
  const stmt = sqliteDb.prepare("SELECT id, accountId, type, message, timestamp FROM logs ORDER BY timestamp DESC LIMIT ?");
  return stmt.all(safeLimit) as AuditLogRow[];
}

export async function bumpAccountSessionVersion(accountId: string): Promise<void> {
  const now = new Date().toISOString();

  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query("UPDATE accounts SET sessionVersion = COALESCE(sessionVersion, 1) + 1, updatedAt = $1 WHERE id = $2", [
      now,
      accountId,
    ]);
    return;
  }

  if (!sqliteDb) return;
  sqliteDb.prepare("UPDATE accounts SET sessionVersion = COALESCE(sessionVersion, 1) + 1, updatedAt = ? WHERE id = ?").run(now, accountId);
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(
  accountId: string,
  options?: { expiresInMinutes?: number; createdBy?: string | null }
): Promise<{ token: string; expiresAt: string }> {
  const expiresInMinutes = Math.max(5, Math.min(24 * 60, options?.expiresInMinutes ?? 60));
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000).toISOString();
  const id = `prt_${Date.now()}_${randomBytes(4).toString("hex")}`;

  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query(
      "INSERT INTO account_password_reset_tokens (id,accountId,tokenHash,expiresAt,createdAt,createdBy,usedAt) VALUES ($1,$2,$3,$4,$5,$6,NULL)",
      [id, accountId, tokenHash, expiresAt, createdAt, options?.createdBy ?? null]
    );
    return { token, expiresAt };
  }

  if (!sqliteDb) {
    return { token, expiresAt };
  }

  const stmt = sqliteDb.prepare(
    "INSERT INTO account_password_reset_tokens (id,accountId,tokenHash,expiresAt,createdAt,createdBy,usedAt) VALUES (?,?,?,?,?,?,NULL)"
  );
  stmt.run(id, accountId, tokenHash, expiresAt, createdAt, options?.createdBy ?? null);
  return { token, expiresAt };
}

export async function consumePasswordResetToken(token: string): Promise<{ accountId: string } | null> {
  const normalizedToken = token.trim();
  if (!normalizedToken) return null;

  const tokenHash = hashResetToken(normalizedToken);
  const now = new Date().toISOString();

  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query(
      "SELECT id, accountId FROM account_password_reset_tokens WHERE tokenHash = $1 AND usedAt IS NULL AND expiresAt > $2 ORDER BY createdAt DESC LIMIT 1",
      [tokenHash, now]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;

    const resetId = String(row.id ?? "");
    const accountId = String(row.accountid ?? row.accountId ?? "");
    if (!resetId || !accountId) return null;

    await pgPool.query("UPDATE account_password_reset_tokens SET usedAt = $1 WHERE id = $2", [now, resetId]);
    return { accountId };
  }

  if (!sqliteDb) return null;
  const row = sqliteDb
    .prepare(
      "SELECT id, accountId FROM account_password_reset_tokens WHERE tokenHash = ? AND usedAt IS NULL AND expiresAt > ? ORDER BY createdAt DESC LIMIT 1"
    )
    .get(tokenHash, now) as { id: string; accountId: string } | undefined;

  if (!row?.id || !row.accountId) return null;
  sqliteDb.prepare("UPDATE account_password_reset_tokens SET usedAt = ? WHERE id = ?").run(now, row.id);
  return { accountId: row.accountId };
}

export async function setAccountPassword(accountId: string, plainPassword: string): Promise<void> {
  if (!plainPassword || plainPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const passwordHash = hashPassword(plainPassword);
  const now = new Date().toISOString();

  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query(
      "INSERT INTO account_credentials (accountId,passwordHash,createdAt,updatedAt) VALUES ($1,$2,$3,$4) ON CONFLICT (accountId) DO UPDATE SET passwordHash = EXCLUDED.passwordHash, updatedAt = EXCLUDED.updatedAt",
      [accountId, passwordHash, now, now]
    );
    await bumpAccountSessionVersion(accountId);
    return;
  }
}

export async function authenticateAccount(email: string, plainPassword: string): Promise<AccountRow | undefined> {
  const account = await getAccountByEmail(email);
  if (!account) return undefined;
  if (!account.isActive) return undefined;

  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    const result = await pgPool.query("SELECT passwordHash FROM account_credentials WHERE accountId = $1", [account.id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    const passwordHash = (row?.passwordhash as string | undefined) ?? (row?.passwordHash as string | undefined);

    if (!verifyPassword(plainPassword, passwordHash)) return undefined;
    return account;
  }

  return undefined;
}

export async function ensureAccounts(accounts: Partial<AccountRow>[]) {
  for (const a of accounts) {
    if (!a.id) continue;
    const existing = await getAccountById(a.id as string);
    if (!existing) {
      await createAccount(a);
    }
  }
}

async function ensureSeedAccounts() {
  try {
    // require here to keep it server-only and avoid ESM issues in client bundles
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const seed = require("./server-seed");
    if (seed && Array.isArray(seed.initialAccounts)) {
      await ensureAccounts(seed.initialAccounts);
    }
  } catch {
    // ignore when used in environments where server-seed isn't available
  }
}

// Migration: ensure `locale` column exists for older DBs
if (sqliteDb) {
  try {
    const info = sqliteDb.prepare("PRAGMA table_info(accounts)").all() as Array<{ name?: string }>;
    const hasFirstName = info.some((columnInfo) => columnInfo.name === "firstName");
    const hasLastName = info.some((columnInfo) => columnInfo.name === "lastName");
    const hasLocale = info.some((columnInfo) => columnInfo.name === "locale");
    const hasIsActive = info.some((columnInfo) => columnInfo.name === "isActive");
    const hasSessionVersion = info.some((columnInfo) => columnInfo.name === "sessionVersion");

    if (!hasFirstName) {
      sqliteDb.prepare("ALTER TABLE accounts ADD COLUMN firstName TEXT").run();
    }
    if (!hasLastName) {
      sqliteDb.prepare("ALTER TABLE accounts ADD COLUMN lastName TEXT").run();
    }
    if (!hasLocale) {
      sqliteDb.prepare("ALTER TABLE accounts ADD COLUMN locale TEXT DEFAULT 'fr'").run();
    }
    if (!hasIsActive) {
      sqliteDb.prepare("ALTER TABLE accounts ADD COLUMN isActive INTEGER DEFAULT 1").run();
    }
    if (!hasSessionVersion) {
      sqliteDb.prepare("ALTER TABLE accounts ADD COLUMN sessionVersion INTEGER DEFAULT 1").run();
    }

    const rows = sqliteDb
      .prepare("SELECT id, fullName, firstName, lastName, role FROM accounts")
      .all() as Array<{
        id: string;
        fullName?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        role?: string | null;
      }>;

    const migrateStmt = sqliteDb.prepare(
      "UPDATE accounts SET firstName = ?, lastName = ?, fullName = ?, role = ? WHERE id = ?"
    );

    for (const row of rows) {
      const split = splitFullName(row.fullName);
      const firstName = row.firstName ?? split.firstName;
      const lastName = row.lastName ?? split.lastName;
      const fullName = buildFullName(firstName, lastName, row.fullName);
      const role = normalizeRole(row.role);
      migrateStmt.run(firstName ?? null, lastName ?? null, fullName ?? null, role, row.id);
    }
  } catch {
    // ignore migration errors
  }
}

void ensureSeedAccounts();
