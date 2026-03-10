import { getSharedPgPool } from "@/lib/pg-pool";
import type { RightPanelConfigOverride } from "@/lib/right-panel-types";

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

let postgresReady: Promise<void> | null = null;

async function ensurePostgresSchema() {
  await pgPool.query(`
CREATE TABLE IF NOT EXISTS right_panel_config_overrides (
  panelId TEXT PRIMARY KEY,
  overrideJson JSONB NOT NULL,
  updatedAt TEXT NOT NULL,
  updatedBy TEXT
)
`);
}

async function ensurePostgresReady() {
  if (!postgresReady) {
    postgresReady = ensurePostgresSchema();
  }
  await postgresReady;
}

function normalizeOverride(value: unknown): RightPanelConfigOverride {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as RightPanelConfigOverride;
}

export async function getRightPanelConfigOverride(panelId: string): Promise<RightPanelConfigOverride | null> {
  await ensurePostgresReady();
  const result = await pgPool.query(
    "SELECT overrideJson FROM right_panel_config_overrides WHERE panelId = $1 LIMIT 1",
    [panelId]
  );

  const row = result.rows[0] as { overridejson?: unknown; overrideJson?: unknown } | undefined;
  if (!row) return null;
  return normalizeOverride(row.overridejson ?? row.overrideJson);
}

export async function getAllRightPanelConfigOverrides(): Promise<Record<string, RightPanelConfigOverride>> {
  await ensurePostgresReady();
  const result = await pgPool.query("SELECT panelId, overrideJson FROM right_panel_config_overrides");

  const output: Record<string, RightPanelConfigOverride> = {};
  for (const rawRow of result.rows) {
    const row = rawRow as {
      panelid?: string;
      panelId?: string;
      overridejson?: unknown;
      overrideJson?: unknown;
    };
    const panelId = String(row.panelid ?? row.panelId ?? "");
    if (!panelId) continue;
    output[panelId] = normalizeOverride(row.overridejson ?? row.overrideJson);
  }

  return output;
}

export async function upsertRightPanelConfigOverride(input: {
  panelId: string;
  override: RightPanelConfigOverride;
  updatedBy?: string | null;
}) {
  await ensurePostgresReady();

  const now = new Date().toISOString();
  await pgPool.query(
    `INSERT INTO right_panel_config_overrides (panelId, overrideJson, updatedAt, updatedBy)
     VALUES ($1, $2::jsonb, $3, $4)
     ON CONFLICT (panelId)
     DO UPDATE SET overrideJson = EXCLUDED.overrideJson, updatedAt = EXCLUDED.updatedAt, updatedBy = EXCLUDED.updatedBy`,
    [input.panelId, JSON.stringify(input.override ?? {}), now, input.updatedBy ?? null]
  );
}
