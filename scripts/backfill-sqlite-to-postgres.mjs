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
  console.error("[backfill] DATABASE_URL is required");
  process.exit(1);
}

const migrationFiles = [
  "001_postgres_connectors.sql",
  "002_postgres_tabs.sql",
  "003_postgres_security.sql",
  "004_postgres_accounts.sql",
  "005_postgres_dashboard_graphs.sql",
].map((fileName) => path.resolve(root, "data", "migrations", fileName));

for (const filePath of migrationFiles) {
  if (!fs.existsSync(filePath)) {
    console.error(`[backfill] Missing migration file: ${filePath}`);
    process.exit(1);
  }
}

if (!fs.existsSync(sqlitePath)) {
  console.error(`[backfill] SQLite file not found: ${sqlitePath}`);
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

async function runMigrations() {
  for (const filePath of migrationFiles) {
    const sql = fs.readFileSync(filePath, "utf8");
    await pg.query(sql);
    console.log(`[backfill] Applied migration: ${path.basename(filePath)}`);
  }
}

function getRows(tableName) {
  return sqlite.prepare(`SELECT * FROM ${tableName}`).all();
}

async function upsertBatch(tableName, rows, queryFactory) {
  if (rows.length === 0) {
    console.log(`[backfill] ${tableName}: 0 row`);
    return;
  }

  for (const row of rows) {
    const query = queryFactory(row);
    await pg.query(query.text, query.values);
  }

  console.log(`[backfill] ${tableName}: ${rows.length} row(s) synced`);
}

async function main() {
  console.log(`[backfill] SQLite source: ${sqlitePath}`);
  await runMigrations();

  await upsertBatch("data_connectors", getRows("data_connectors"), (row) => ({
    text: `
      INSERT INTO data_connectors (id, name, provider, enabled, configEncrypted, createdBy, createdAt, updatedAt)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        provider = EXCLUDED.provider,
        enabled = EXCLUDED.enabled,
        configEncrypted = EXCLUDED.configEncrypted,
        createdBy = EXCLUDED.createdBy,
        createdAt = EXCLUDED.createdAt,
        updatedAt = EXCLUDED.updatedAt
    `,
    values: [
      row.id,
      row.name,
      row.provider,
      row.enabled,
      row.configEncrypted,
      row.createdBy,
      row.createdAt,
      row.updatedAt,
    ],
  }));

  await upsertBatch("app_tabs", getRows("app_tabs"), (row) => ({
    text: `
      INSERT INTO app_tabs (id, slug, title, subtitle, icon, enabled, isSystem, createdBy, configJson, createdAt, updatedAt)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        icon = EXCLUDED.icon,
        enabled = EXCLUDED.enabled,
        isSystem = EXCLUDED.isSystem,
        createdBy = EXCLUDED.createdBy,
        configJson = EXCLUDED.configJson,
        createdAt = EXCLUDED.createdAt,
        updatedAt = EXCLUDED.updatedAt
    `,
    values: [
      row.id,
      row.slug,
      row.title,
      row.subtitle,
      row.icon,
      row.enabled,
      row.isSystem,
      row.createdBy,
      row.configJson,
      row.createdAt,
      row.updatedAt,
    ],
  }));

  await upsertBatch("app_tab_group_visibility", getRows("app_tab_group_visibility"), (row) => ({
    text: `
      INSERT INTO app_tab_group_visibility (tabId, groupId, createdAt)
      VALUES ($1,$2,$3)
      ON CONFLICT (tabId, groupId) DO UPDATE SET
        createdAt = EXCLUDED.createdAt
    `,
    values: [row.tabId, row.groupId, row.createdAt],
  }));

  await upsertBatch("user_groups", getRows("user_groups"), (row) => ({
    text: `
      INSERT INTO user_groups (id, name, description, isDefault, createdAt, updatedAt)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        isDefault = EXCLUDED.isDefault,
        createdAt = EXCLUDED.createdAt,
        updatedAt = EXCLUDED.updatedAt
    `,
    values: [row.id, row.name, row.description, row.isDefault, row.createdAt, row.updatedAt],
  }));

  await upsertBatch("account_group_memberships", getRows("account_group_memberships"), (row) => ({
    text: `
      INSERT INTO account_group_memberships (accountId, groupId, createdAt, updatedAt)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (accountId) DO UPDATE SET
        groupId = EXCLUDED.groupId,
        createdAt = EXCLUDED.createdAt,
        updatedAt = EXCLUDED.updatedAt
    `,
    values: [row.accountId, row.groupId, row.createdAt, row.updatedAt],
  }));

  await upsertBatch("security_settings", getRows("security_settings"), (row) => ({
    text: `
      INSERT INTO security_settings (key, value, updatedAt)
      VALUES ($1,$2,$3)
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updatedAt = EXCLUDED.updatedAt
    `,
    values: [row.key, row.value, row.updatedAt],
  }));

  await upsertBatch("ip_allowlist_entries", getRows("ip_allowlist_entries"), (row) => ({
    text: `
      INSERT INTO ip_allowlist_entries (id, ipOrCidr, label, isActive, createdAt, updatedAt)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO UPDATE SET
        ipOrCidr = EXCLUDED.ipOrCidr,
        label = EXCLUDED.label,
        isActive = EXCLUDED.isActive,
        createdAt = EXCLUDED.createdAt,
        updatedAt = EXCLUDED.updatedAt
    `,
    values: [row.id, row.ipOrCidr, row.label, row.isActive, row.createdAt, row.updatedAt],
  }));

  await upsertBatch("accounts", getRows("accounts"), (row) => ({
    text: `
      INSERT INTO accounts (id, email, firstName, lastName, fullName, role, profileImage, locale, totpEnabled, totpSecret, extras, createdAt, updatedAt)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        firstName = EXCLUDED.firstName,
        lastName = EXCLUDED.lastName,
        fullName = EXCLUDED.fullName,
        role = EXCLUDED.role,
        profileImage = EXCLUDED.profileImage,
        locale = EXCLUDED.locale,
        totpEnabled = EXCLUDED.totpEnabled,
        totpSecret = EXCLUDED.totpSecret,
        extras = EXCLUDED.extras,
        createdAt = EXCLUDED.createdAt,
        updatedAt = EXCLUDED.updatedAt
    `,
    values: [
      row.id,
      row.email,
      row.firstName,
      row.lastName,
      row.fullName,
      row.role,
      row.profileImage,
      row.locale,
      row.totpEnabled,
      row.totpSecret,
      row.extras,
      row.createdAt,
      row.updatedAt,
    ],
  }));

  await upsertBatch("logs", getRows("logs"), (row) => ({
    text: `
      INSERT INTO logs (id, accountId, type, message, timestamp)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (id) DO UPDATE SET
        accountId = EXCLUDED.accountId,
        type = EXCLUDED.type,
        message = EXCLUDED.message,
        timestamp = EXCLUDED.timestamp
    `,
    values: [row.id, row.accountId, row.type, row.message, row.timestamp],
  }));

  await upsertBatch("dashboard_graphs", getRows("dashboard_graphs"), (row) => ({
    text: `
      INSERT INTO dashboard_graphs (id, ownerUserId, title, description, size, layoutOrder, isShared, sharedFromGraphId, config, createdAt, updatedAt)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO UPDATE SET
        ownerUserId = EXCLUDED.ownerUserId,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        size = EXCLUDED.size,
        layoutOrder = EXCLUDED.layoutOrder,
        isShared = EXCLUDED.isShared,
        sharedFromGraphId = EXCLUDED.sharedFromGraphId,
        config = EXCLUDED.config,
        createdAt = EXCLUDED.createdAt,
        updatedAt = EXCLUDED.updatedAt
    `,
    values: [
      row.id,
      row.ownerUserId,
      row.title,
      row.description,
      row.size,
      row.layoutOrder,
      row.isShared,
      row.sharedFromGraphId,
      row.config,
      row.createdAt,
      row.updatedAt,
    ],
  }));

  console.log("[backfill] Done");
}

main()
  .catch((error) => {
    console.error("[backfill] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    sqlite.close();
    await pg.end();
  });
