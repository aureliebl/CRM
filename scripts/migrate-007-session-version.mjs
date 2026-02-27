import fs from "fs";
import path from "path";
import { Pool } from "pg";

const root = process.cwd();
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[migrate:007] DATABASE_URL is required");
  process.exit(1);
}

const migrationPath = path.resolve(root, "data", "migrations", "007_postgres_session_version.sql");
if (!fs.existsSync(migrationPath)) {
  console.error(`[migrate:007] Migration file not found: ${migrationPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, "utf8");

const pg = new Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.PGSSL === "true"
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
});

async function main() {
  console.log(`[migrate:007] Running migration from ${migrationPath}`);
  await pg.query(sql);
  console.log("[migrate:007] Done");
}

main()
  .catch((error) => {
    console.error("[migrate:007] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pg.end();
  });
