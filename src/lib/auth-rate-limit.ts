import { createHash, randomBytes } from "crypto";
import { Pool } from "pg";

type ConsumeRateLimitParams = {
  action: string;
  scope: string;
  maxAttempts: number;
  windowMs: number;
  blockMs: number;
};

type ConsumeRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

const databaseUrl = process.env.DATABASE_URL;

const pgPoolMax = Math.max(1, Number(process.env.PGPOOL_MAX_CONNECTIONS || 1));
const pgPoolMin = Math.max(0, Number(process.env.PGPOOL_MIN_CONNECTIONS || 0));
const pgConnectionTimeoutMs = Math.max(
  1000,
  Number(process.env.PG_CONNECTION_TIMEOUT_MS || 15000)
);
const pgIdleTimeoutMs = Math.max(1000, Number(process.env.PG_IDLE_TIMEOUT_MS || 10000));

const pgPool = databaseUrl
  ? new Pool({
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
    })
  : null;

let readyPromise: Promise<void> | null = null;

async function ensureSchema() {
  if (!pgPool) return;

  await pgPool.query(`
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  scopeHash TEXT NOT NULL,
  count INTEGER NOT NULL,
  windowStart TEXT NOT NULL,
  blockedUntil TEXT,
  updatedAt TEXT NOT NULL
)
`);

  await pgPool.query("CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_action ON auth_rate_limits(action)");
  await pgPool.query("CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_updated_at ON auth_rate_limits(updatedAt)");
}

async function ensureReady() {
  if (!pgPool) return;
  if (!readyPromise) {
    readyPromise = ensureSchema();
  }
  await readyPromise;
}

function hashScope(scope: string): string {
  return createHash("sha256").update(scope).digest("hex");
}

function toIso(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}

function secondsUntil(timestampIso: string): number {
  const deltaMs = new Date(timestampIso).getTime() - Date.now();
  return Math.max(1, Math.ceil(deltaMs / 1000));
}

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export async function consumeAuthRateLimit(params: ConsumeRateLimitParams): Promise<ConsumeRateLimitResult> {
  if (!pgPool) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: params.maxAttempts,
    };
  }

  await ensureReady();

  const nowMs = Date.now();
  const nowIso = toIso(nowMs);
  const maxAttempts = Math.max(1, Math.trunc(params.maxAttempts));
  const windowMs = Math.max(1_000, Math.trunc(params.windowMs));
  const blockMs = Math.max(1_000, Math.trunc(params.blockMs));

  const scopeHash = hashScope(params.scope);
  const id = `${params.action}:${scopeHash}`;

  const selected = await pgPool.query(
    "SELECT count, windowStart, blockedUntil FROM auth_rate_limits WHERE id = $1 LIMIT 1",
    [id]
  );

  const row = selected.rows[0] as
    | {
        count?: number | string;
        windowstart?: string;
        windowStart?: string;
        blockeduntil?: string | null;
        blockedUntil?: string | null;
      }
    | undefined;

  const blockedUntilIso = (row?.blockeduntil ?? row?.blockedUntil ?? null) || null;
  if (blockedUntilIso && new Date(blockedUntilIso).getTime() > nowMs) {
    return {
      allowed: false,
      retryAfterSeconds: secondsUntil(blockedUntilIso),
      remaining: 0,
    };
  }

  const windowStartIso = row?.windowstart ?? row?.windowStart ?? null;
  const existingCount = Number(row?.count ?? 0);
  const inSameWindow =
    !!windowStartIso && Number.isFinite(existingCount) && new Date(windowStartIso).getTime() + windowMs > nowMs;

  let nextCount = 1;
  let nextWindowStart = nowIso;
  let nextBlockedUntil: string | null = null;

  if (inSameWindow) {
    nextCount = existingCount + 1;
    nextWindowStart = windowStartIso as string;
  }

  if (nextCount > maxAttempts) {
    nextBlockedUntil = toIso(nowMs + blockMs);
  }

  await pgPool.query(
    "INSERT INTO auth_rate_limits (id, action, scopeHash, count, windowStart, blockedUntil, updatedAt) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET count = EXCLUDED.count, windowStart = EXCLUDED.windowStart, blockedUntil = EXCLUDED.blockedUntil, updatedAt = EXCLUDED.updatedAt",
    [id, params.action, scopeHash, nextCount, nextWindowStart, nextBlockedUntil, nowIso]
  );

  if (nextBlockedUntil) {
    return {
      allowed: false,
      retryAfterSeconds: secondsUntil(nextBlockedUntil),
      remaining: 0,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, maxAttempts - nextCount),
  };
}

export async function cleanupAuthRateLimits(maxAgeHours = 48): Promise<void> {
  if (!pgPool) return;
  await ensureReady();

  const ttlMs = Math.max(1, Math.trunc(maxAgeHours)) * 60 * 60 * 1000;
  const cutoffIso = toIso(Date.now() - ttlMs);
  await pgPool.query("DELETE FROM auth_rate_limits WHERE updatedAt < $1", [cutoffIso]);
}

export async function maybeCleanupAuthRateLimits() {
  const shouldRun = randomBytes(1)[0] % 50 === 0;
  if (!shouldRun) return;
  await cleanupAuthRateLimits(48);
}
