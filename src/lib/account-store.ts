import path from "path";
import fs from "fs";
import Database from "better-sqlite3";

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "accounts.db");
const db = new Database(dbPath);

// Initialize tables
db.exec(`
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

export function getAllAccounts(): AccountRow[] {
  const stmt = db.prepare("SELECT * FROM accounts ORDER BY fullName ASC");
  return stmt.all() as AccountRow[];
}

export function getAccountById(id: string): AccountRow | undefined {
  const stmt = db.prepare("SELECT * FROM accounts WHERE id = ?");
  return stmt.get(id) as AccountRow | undefined;
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

export function createAccount(row: Partial<AccountRow>) {
  const now = new Date().toISOString();
  const id = row.id ?? `u_${Date.now()}`;
  const split = splitFullName(row.fullName);
  const firstName = row.firstName ?? split.firstName;
  const lastName = row.lastName ?? split.lastName;
  const fullName = buildFullName(firstName, lastName, row.fullName);

  const stmt = db.prepare(`INSERT INTO accounts (id,email,firstName,lastName,fullName,role,profileImage,locale,totpEnabled,totpSecret,extras,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  stmt.run(
    id,
    row.email ?? null,
    firstName,
    lastName,
    fullName,
    normalizeRole(row.role),
    row.profileImage ?? null,
    row.locale ?? 'fr',
    row.totpEnabled ? 1 : 0,
    row.totpSecret ?? null,
    row.extras ?? null,
    now,
    now
  );
  return getAccountById(id);
}

export function updateAccount(id: string, patch: Partial<AccountRow>) {
  const existing = getAccountById(id);
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
  const stmt = db.prepare(
    `UPDATE accounts SET email = ?, firstName = ?, lastName = ?, fullName = ?, role = ?, profileImage = ?, locale = ?, totpEnabled = ?, totpSecret = ?, extras = ?, updatedAt = ? WHERE id = ?`
  );
  stmt.run(
    updated.email ?? null,
    updated.firstName ?? null,
    updated.lastName ?? null,
    updated.fullName ?? null,
    normalizeRole(updated.role) ?? null,
    updated.profileImage ?? null,
    updated.locale ?? 'fr',
    updated.totpEnabled ?? 0,
    updated.totpSecret ?? null,
    updated.extras ?? null,
    updated.updatedAt,
    id
  );
  return getAccountById(id);
}

export function deleteAccount(id: string) {
  const stmt = db.prepare("DELETE FROM accounts WHERE id = ?");
  stmt.run(id);
}

export function addLog(accountId: string, type: string, message: string) {
  const id = `log_${Date.now()}`;
  const timestamp = new Date().toISOString();
  const stmt = db.prepare("INSERT INTO logs (id,accountId,type,message,timestamp) VALUES (?,?,?,?,?)");
  stmt.run(id, accountId, type, message, timestamp);
  return { id, accountId, type, message, timestamp };
}

export function ensureAccounts(accounts: Partial<AccountRow>[]) {
  for (const a of accounts) {
    if (!a.id) continue;
    const existing = getAccountById(a.id as string);
    if (!existing) {
      createAccount(a);
    }
  }
}

// If a server-side seed file exists, import and ensure those accounts are present.
try {
  // require here to keep it server-only and avoid ESM issues in client bundles
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const seed = require("./server-seed");
  if (seed && Array.isArray(seed.initialAccounts)) {
    ensureAccounts(seed.initialAccounts);
  }
} catch (err) {
  // ignore when used in environments where server-seed isn't available
}

// Migration: ensure `locale` column exists for older DBs
try {
  const info = db.prepare("PRAGMA table_info(accounts)").all();
  const hasFirstName = info.some((c: any) => c.name === "firstName");
  const hasLastName = info.some((c: any) => c.name === "lastName");
  const hasLocale = info.some((c: any) => c.name === "locale");

  if (!hasFirstName) {
    db.prepare("ALTER TABLE accounts ADD COLUMN firstName TEXT").run();
  }
  if (!hasLastName) {
    db.prepare("ALTER TABLE accounts ADD COLUMN lastName TEXT").run();
  }
  if (!hasLocale) {
    db.prepare("ALTER TABLE accounts ADD COLUMN locale TEXT DEFAULT 'fr'").run();
  }

  const rows = db
    .prepare("SELECT id, fullName, firstName, lastName, role FROM accounts")
    .all() as Array<{
      id: string;
      fullName?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      role?: string | null;
    }>;

  const migrateStmt = db.prepare(
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
} catch (e) {
  // ignore migration errors
}
