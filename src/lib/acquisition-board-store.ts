import { getSharedPgPool } from "@/lib/pg-pool";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required (runtime is PostgreSQL-only)");
}

const pgPoolMax = Math.max(1, Number(process.env.PGPOOL_MAX_CONNECTIONS || 1));
const pgPoolMin = Math.max(0, Number(process.env.PGPOOL_MIN_CONNECTIONS || 0));
const pgConnectionTimeoutMs = Math.max(1000, Number(process.env.PG_CONNECTION_TIMEOUT_MS || 15000));
const pgIdleTimeoutMs = Math.max(1000, Number(process.env.PG_IDLE_TIMEOUT_MS || 10000));

const pgPool = getSharedPgPool({
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

export type AcquisitionQuoteStatus = "new" | "sent" | "accepted" | "expired" | "abandoned";

export type AcquisitionBoardState = {
  unfinished: Record<string, { step?: number; assignedOperatorId?: string | null }>;
  quotes: Record<string, { status?: AcquisitionQuoteStatus; assignedOperatorId?: string | null }>;
  operatorAbsences: Record<string, string[]>;
};

const DEFAULT_STATE: AcquisitionBoardState = {
  unfinished: {},
  quotes: {},
  operatorAbsences: {},
};

let postgresReady: Promise<void> | null = null;

async function ensurePostgresSchema() {
  await pgPool.query(`
CREATE TABLE IF NOT EXISTS acquisition_board_state (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updatedAt TEXT NOT NULL
)
`);
}

async function ensurePostgresReady() {
  if (!postgresReady) {
    postgresReady = ensurePostgresSchema();
  }
  await postgresReady;
}

function normalizeState(input: unknown): AcquisitionBoardState {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_STATE };
  }

  const raw = input as Partial<AcquisitionBoardState>;

  return {
    unfinished: raw.unfinished && typeof raw.unfinished === "object" ? raw.unfinished : {},
    quotes: raw.quotes && typeof raw.quotes === "object" ? raw.quotes : {},
    operatorAbsences:
      raw.operatorAbsences && typeof raw.operatorAbsences === "object"
        ? raw.operatorAbsences
        : {},
  };
}

export async function getAcquisitionBoardState(): Promise<AcquisitionBoardState> {
  await ensurePostgresReady();
  const result = await pgPool.query(
    "SELECT payload FROM acquisition_board_state WHERE id = $1 LIMIT 1",
    ["default"]
  );
  const payload = result.rows[0]?.payload;
  return normalizeState(payload);
}

export async function setAcquisitionBoardState(state: AcquisitionBoardState): Promise<AcquisitionBoardState> {
  await ensurePostgresReady();
  const normalized = normalizeState(state);
  const now = new Date().toISOString();

  await pgPool.query(
    `INSERT INTO acquisition_board_state (id, payload, updatedAt)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (id)
     DO UPDATE SET payload = EXCLUDED.payload, updatedAt = EXCLUDED.updatedAt`,
    ["default", JSON.stringify(normalized), now]
  );

  return normalized;
}
