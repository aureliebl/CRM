import { randomBytes } from "crypto";
import type { UserInvitation, InvitationStatus } from "@/lib/types";
import { getSharedPgPool } from "@/lib/pg-pool";
import { hashToken } from "@/lib/vault-crypto";

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

const pgPool = getSharedPgPool({
  connectionString: databaseUrl,
  max: pgPoolMax,
  min: pgPoolMin,
  connectionTimeoutMillis: pgConnectionTimeoutMs,
  idleTimeoutMillis: pgIdleTimeoutMs,
  ssl:
    process.env.PGSSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
});

let postgresReady: Promise<void> | null = null;

const nowIso = () => new Date().toISOString();

async function ensurePostgresSchema() {
  if (!pgPool) return;

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS user_invitations (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      groupId TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      tokenHash TEXT NOT NULL UNIQUE,
      expiresAt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      invitedBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      acceptedAt TEXT
    )
  `);

  await pgPool.query(
    "ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'operator'"
  );

  await pgPool.query(
    "CREATE INDEX IF NOT EXISTS idx_user_invitations_token_hash ON user_invitations(tokenHash)"
  );
  await pgPool.query(
    "CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email)"
  );
  await pgPool.query(
    "CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(status)"
  );
}

async function ensurePostgresReady() {
  if (!pgPool) return;
  if (!postgresReady) {
    postgresReady = ensurePostgresSchema();
  }
  await postgresReady;
}

function mapRow(row: Record<string, unknown>): UserInvitation {
  return {
    id: String(row.id ?? ""),
    email: String(row.email ?? ""),
    groupId: String(row.groupid ?? row.groupId ?? ""),
    role: (String(row.role ?? "operator") as UserInvitation["role"]),
    expiresAt: String(row.expiresat ?? row.expiresAt ?? ""),
    status: (String(row.status ?? "pending") as InvitationStatus),
    invitedBy: String(row.invitedby ?? row.invitedBy ?? ""),
    createdAt: String(row.createdat ?? row.createdAt ?? ""),
    acceptedAt: (row.acceptedat ?? row.acceptedAt ?? null) as string | null,
  };
}

export async function getAllInvitations(): Promise<UserInvitation[]> {
  await ensurePostgresReady();
  const result = await pgPool.query(
    "SELECT * FROM user_invitations ORDER BY createdAt DESC"
  );
  return result.rows.map((r) => mapRow(r as Record<string, unknown>));
}

export async function getInvitationById(
  id: string
): Promise<UserInvitation | undefined> {
  await ensurePostgresReady();
  const result = await pgPool.query(
    "SELECT * FROM user_invitations WHERE id = $1",
    [id]
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapRow(row) : undefined;
}

export async function getInvitationByToken(
  rawToken: string
): Promise<UserInvitation | undefined> {
  await ensurePostgresReady();
  const tokenDigest = hashToken(rawToken);
  const result = await pgPool.query(
    "SELECT * FROM user_invitations WHERE tokenHash = $1",
    [tokenDigest]
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapRow(row) : undefined;
}

export async function getPendingInvitationByEmail(
  email: string
): Promise<UserInvitation | undefined> {
  const normalized = email.trim().toLowerCase();
  await ensurePostgresReady();
  const result = await pgPool.query(
    "SELECT * FROM user_invitations WHERE LOWER(email) = $1 AND status = 'pending' LIMIT 1",
    [normalized]
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? mapRow(row) : undefined;
}

export function generateInvitationToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Creates an invitation. Returns both the persisted invitation and the raw
 * token (which is NOT stored — only its SHA-256 hash is persisted). The raw
 * token must be included in the email link and must never be stored or logged.
 */
export async function createInvitation(input: {
  email: string;
  groupId: string;
  invitedBy: string;
  role?: "admin" | "operator";
  expiresInDays?: number;
}): Promise<{ invitation: UserInvitation; rawToken: string }> {
  await ensurePostgresReady();

  const id = `inv_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const rawToken = generateInvitationToken();
  const tokenDigest = hashToken(rawToken);
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresInDays = input.expiresInDays ?? 7;
  const expiresAt = new Date(
    now.getTime() + expiresInDays * 24 * 60 * 60 * 1000
  ).toISOString();
  const role = input.role ?? "operator";

  await pgPool.query(
    `INSERT INTO user_invitations (id, email, groupId, role, tokenHash, expiresAt, status, invitedBy, createdAt, acceptedAt)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, NULL)`,
    [id, input.email.trim().toLowerCase(), input.groupId, role, tokenDigest, expiresAt, input.invitedBy, createdAt]
  );

  const inv = await getInvitationById(id);
  if (!inv) throw new Error("Failed to create invitation");
  return { invitation: inv, rawToken };
}

export async function cancelInvitation(id: string): Promise<void> {
  await ensurePostgresReady();
  await pgPool.query(
    "DELETE FROM user_invitations WHERE id = $1 AND status = 'pending'",
    [id]
  );
}

/**
 * Regenerates token + resets expiry. Returns both the updated invitation and
 * the new raw token for the email link. The raw token is never persisted.
 */
export async function resendInvitation(id: string): Promise<{ invitation: UserInvitation; rawToken: string } | undefined> {
  await ensurePostgresReady();
  const existing = await getInvitationById(id);
  if (!existing) return undefined;
  if (existing.status !== "pending" && existing.status !== "expired") return undefined;

  const rawToken = generateInvitationToken();
  const tokenDigest = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await pgPool.query(
    "UPDATE user_invitations SET tokenHash = $1, expiresAt = $2, status = 'pending' WHERE id = $3",
    [tokenDigest, expiresAt, id]
  );

  const inv = await getInvitationById(id);
  if (!inv) return undefined;
  return { invitation: inv, rawToken };
}

export async function acceptInvitation(id: string): Promise<void> {
  await ensurePostgresReady();
  const now = nowIso();
  await pgPool.query(
    "UPDATE user_invitations SET status = 'accepted', acceptedAt = $1 WHERE id = $2",
    [now, id]
  );
}

export async function getPendingInvitationsByGroupId(groupId: string): Promise<UserInvitation[]> {
  await ensurePostgresReady();
  const result = await pgPool.query(
    "SELECT * FROM user_invitations WHERE groupId = $1 AND status = 'pending'",
    [groupId]
  );
  return result.rows.map((r) => mapRow(r as Record<string, unknown>));
}

export async function expireOldInvitations(): Promise<number> {
  await ensurePostgresReady();
  const now = nowIso();
  const result = await pgPool.query(
    "UPDATE user_invitations SET status = 'expired' WHERE status = 'pending' AND expiresAt < $1",
    [now]
  );
  return result.rowCount ?? 0;
}
