import { Pool } from "pg";
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
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT,
  firstName TEXT,
  lastName TEXT,
  fullName TEXT,
  role TEXT,
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
`);
}

export type AccountRow = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName: string;
  role: string;
  profileImage?: string | null;
  locale?: string | null;
  totpEnabled: number;
  totpSecret?: string | null;
  extras?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

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
  profileImage TEXT,
  locale TEXT DEFAULT 'fr',
  totpEnabled INTEGER DEFAULT 0,
  totpSecret TEXT,
  extras TEXT,
  createdAt TEXT,
  updatedAt TEXT
)
`);

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
      "INSERT INTO accounts (id,email,firstName,lastName,fullName,role,profileImage,locale,totpEnabled,totpSecret,extras,createdAt,updatedAt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
      [
        id,
        row.email ?? null,
        firstName,
        lastName,
        fullName,
        normalizeRole(row.role),
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
    "INSERT INTO accounts (id,email,firstName,lastName,fullName,role,profileImage,locale,totpEnabled,totpSecret,extras,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
  );
  stmt.run(
    id,
    row.email ?? null,
    firstName,
    lastName,
    fullName,
    normalizeRole(row.role),
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
    updatedAt: new Date().toISOString(),
  };
  if (usePostgres && pgPool) {
    await ensurePostgresReady();
    await pgPool.query(
      "UPDATE accounts SET email = $1, firstName = $2, lastName = $3, fullName = $4, role = $5, profileImage = $6, locale = $7, totpEnabled = $8, totpSecret = $9, extras = $10, updatedAt = $11 WHERE id = $12",
      [
        updated.email ?? null,
        updated.firstName ?? null,
        updated.lastName ?? null,
        updated.fullName ?? null,
        normalizeRole(updated.role) ?? null,
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
    "UPDATE accounts SET email = ?, firstName = ?, lastName = ?, fullName = ?, role = ?, profileImage = ?, locale = ?, totpEnabled = ?, totpSecret = ?, extras = ?, updatedAt = ? WHERE id = ?"
  );
  stmt.run(
    updated.email ?? null,
    updated.firstName ?? null,
    updated.lastName ?? null,
    updated.fullName ?? null,
    normalizeRole(updated.role) ?? null,
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
    await pgPool.query("DELETE FROM accounts WHERE id = $1", [id]);
    return;
  }

  if (!sqliteDb) return;
  const stmt = sqliteDb.prepare("DELETE FROM accounts WHERE id = ?");
  stmt.run(id);
}

export async function addLog(accountId: string, type: string, message: string) {
  const id = `log_${Date.now()}`;
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
    return;
  }
}

export async function authenticateAccount(email: string, plainPassword: string): Promise<AccountRow | undefined> {
  const account = await getAccountByEmail(email);
  if (!account) return undefined;

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

    if (!hasFirstName) {
      sqliteDb.prepare("ALTER TABLE accounts ADD COLUMN firstName TEXT").run();
    }
    if (!hasLastName) {
      sqliteDb.prepare("ALTER TABLE accounts ADD COLUMN lastName TEXT").run();
    }
    if (!hasLocale) {
      sqliteDb.prepare("ALTER TABLE accounts ADD COLUMN locale TEXT DEFAULT 'fr'").run();
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
