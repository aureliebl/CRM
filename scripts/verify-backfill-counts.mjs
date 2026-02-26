import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { Pool } from "pg";

const root = process.cwd();
const sqlitePath = process.env.SQLITE_PATH
  ? path.resolve(root, process.env.SQLITE_PATH)
  : path.resolve(root, "data", "accounts.db");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[verify] DATABASE_URL is required");
  process.exit(1);
}

if (!fs.existsSync(sqlitePath)) {
  console.error(`[verify] SQLite file not found: ${sqlitePath}`);
  process.exit(1);
}

const sqlite = new Database(sqlitePath, { readonly: true });
const pg = new Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.PGSSL === "true"
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
});

const tables = [
  "data_connectors",
  "app_tabs",
  "app_tab_group_visibility",
  "user_groups",
  "account_group_memberships",
  "security_settings",
  "ip_allowlist_entries",
  "accounts",
  "logs",
  "dashboard_graphs",
];

function getSqliteCount(tableName) {
  const row = sqlite.prepare(`SELECT COUNT(*) as c FROM ${tableName}`).get();
  return Number(row?.c ?? 0);
}

async function getPostgresCount(tableName) {
  const result = await pg.query(`SELECT COUNT(*)::int as c FROM ${tableName}`);
  return Number(result.rows[0]?.c ?? 0);
}

async function main() {
  let hasMismatch = false;
  console.log(`[verify] SQLite source: ${sqlitePath}`);

  for (const tableName of tables) {
    const sqliteCount = getSqliteCount(tableName);
    const postgresCount = await getPostgresCount(tableName);
    const status = sqliteCount === postgresCount ? "OK" : "MISMATCH";

    if (status === "MISMATCH") {
      hasMismatch = true;
    }

    console.log(
      `[verify] ${status} ${tableName}: sqlite=${sqliteCount} postgres=${postgresCount}`
    );
  }

  if (hasMismatch) {
    console.error("[verify] Count mismatch detected");
    process.exitCode = 2;
    return;
  }

  console.log("[verify] All table counts match");
}

main()
  .catch((error) => {
    console.error("[verify] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    sqlite.close();
    await pg.end();
  });
