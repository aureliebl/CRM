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
  console.error("[verify-content] DATABASE_URL is required");
  process.exit(1);
}

if (!fs.existsSync(sqlitePath)) {
  console.error(`[verify-content] SQLite file not found: ${sqlitePath}`);
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

const strictMode = process.env.VERIFY_STRICT === "true";

const get = (row, ...keys) => {
  for (const key of keys) {
    if (row && Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  }
  return undefined;
};

const normalizeValue = (value) => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return String(value);
};

const normalizeRows = (rows, mapRow) =>
  rows.map((row) => {
    const mapped = mapRow(row);
    const normalized = {};
    for (const [key, value] of Object.entries(mapped)) {
      normalized[key] = normalizeValue(value);
    }
    return normalized;
  });

function fingerprintRows(rows, keyFields) {
  const sorted = [...rows].sort((a, b) => {
    const aKey = keyFields.map((k) => a[k] ?? "").join("|");
    const bKey = keyFields.map((k) => b[k] ?? "").join("|");
    return aKey.localeCompare(bKey);
  });
  return JSON.stringify(sorted);
}

const checks = [
  {
    table: "data_connectors",
    keyFields: ["id"],
    sqliteQuery: "SELECT id, name, provider, enabled, configEncrypted, createdBy, createdAt, updatedAt FROM data_connectors",
    pgQuery: "SELECT id, name, provider, enabled, configencrypted, createdby, createdat, updatedat FROM data_connectors",
    mapSqlite: (row) => ({
      id: get(row, "id"),
      name: get(row, "name"),
      provider: get(row, "provider"),
      enabled: get(row, "enabled"),
      configEncrypted: get(row, "configEncrypted"),
      createdBy: get(row, "createdBy"),
      createdAt: get(row, "createdAt"),
      updatedAt: get(row, "updatedAt"),
    }),
    mapPg: (row) => ({
      id: get(row, "id"),
      name: get(row, "name"),
      provider: get(row, "provider"),
      enabled: get(row, "enabled"),
      configEncrypted: get(row, "configencrypted"),
      createdBy: get(row, "createdby"),
      createdAt: get(row, "createdat"),
      updatedAt: get(row, "updatedat"),
    }),
  },
  {
    table: "app_tabs",
    keyFields: ["id"],
    sqliteQuery: "SELECT id, slug, title, subtitle, icon, enabled, isSystem, createdBy, configJson, createdAt, updatedAt FROM app_tabs",
    pgQuery: "SELECT id, slug, title, subtitle, icon, enabled, issystem, createdby, configjson, createdat, updatedat FROM app_tabs",
    mapSqlite: (row) => ({
      id: get(row, "id"),
      slug: get(row, "slug"),
      title: get(row, "title"),
      subtitle: get(row, "subtitle"),
      icon: get(row, "icon"),
      enabled: get(row, "enabled"),
      isSystem: get(row, "isSystem"),
      createdBy: get(row, "createdBy"),
      configJson: get(row, "configJson"),
      createdAt: get(row, "createdAt"),
      updatedAt: get(row, "updatedAt"),
    }),
    mapPg: (row) => ({
      id: get(row, "id"),
      slug: get(row, "slug"),
      title: get(row, "title"),
      subtitle: get(row, "subtitle"),
      icon: get(row, "icon"),
      enabled: get(row, "enabled"),
      isSystem: get(row, "issystem"),
      createdBy: get(row, "createdby"),
      configJson: get(row, "configjson"),
      createdAt: get(row, "createdat"),
      updatedAt: get(row, "updatedat"),
    }),
  },
  {
    table: "app_tab_group_visibility",
    keyFields: ["tabId", "groupId"],
    sqliteQuery: "SELECT tabId, groupId, createdAt FROM app_tab_group_visibility",
    pgQuery: "SELECT tabid, groupid, createdat FROM app_tab_group_visibility",
    mapSqlite: (row) => ({
      tabId: get(row, "tabId"),
      groupId: get(row, "groupId"),
      createdAt: get(row, "createdAt"),
    }),
    mapPg: (row) => ({
      tabId: get(row, "tabid"),
      groupId: get(row, "groupid"),
      createdAt: get(row, "createdat"),
    }),
  },
  {
    table: "accounts",
    keyFields: ["id"],
    sqliteQuery: "SELECT id, email, firstName, lastName, fullName, role, profileImage, locale, totpEnabled, totpSecret, extras, createdAt, updatedAt FROM accounts",
    pgQuery: "SELECT id, email, firstname, lastname, fullname, role, profileimage, locale, totpenabled, totpsecret, extras, createdat, updatedat FROM accounts",
    mapSqlite: (row) => ({
      id: get(row, "id"),
      email: get(row, "email"),
      firstName: get(row, "firstName"),
      lastName: get(row, "lastName"),
      fullName: get(row, "fullName"),
      role: get(row, "role"),
      profileImage: get(row, "profileImage"),
      locale: get(row, "locale"),
      totpEnabled: get(row, "totpEnabled"),
      totpSecret: get(row, "totpSecret"),
      extras: get(row, "extras"),
      createdAt: get(row, "createdAt"),
      updatedAt: get(row, "updatedAt"),
    }),
    mapPg: (row) => ({
      id: get(row, "id"),
      email: get(row, "email"),
      firstName: get(row, "firstname"),
      lastName: get(row, "lastname"),
      fullName: get(row, "fullname"),
      role: get(row, "role"),
      profileImage: get(row, "profileimage"),
      locale: get(row, "locale"),
      totpEnabled: get(row, "totpenabled"),
      totpSecret: get(row, "totpsecret"),
      extras: get(row, "extras"),
      createdAt: get(row, "createdat"),
      updatedAt: get(row, "updatedat"),
    }),
  },
  {
    table: "dashboard_graphs",
    keyFields: ["id"],
    sqliteQuery: "SELECT id, ownerUserId, title, description, size, layoutOrder, isShared, sharedFromGraphId, config, createdAt, updatedAt FROM dashboard_graphs",
    pgQuery: "SELECT id, owneruserid, title, description, size, layoutorder, isshared, sharedfromgraphid, config, createdat, updatedat FROM dashboard_graphs",
    mapSqlite: (row) => ({
      id: get(row, "id"),
      ownerUserId: get(row, "ownerUserId"),
      title: get(row, "title"),
      description: get(row, "description"),
      size: get(row, "size"),
      layoutOrder: get(row, "layoutOrder"),
      isShared: get(row, "isShared"),
      sharedFromGraphId: get(row, "sharedFromGraphId"),
      config: get(row, "config"),
      createdAt: get(row, "createdAt"),
      updatedAt: get(row, "updatedAt"),
    }),
    mapPg: (row) => ({
      id: get(row, "id"),
      ownerUserId: get(row, "owneruserid"),
      title: get(row, "title"),
      description: get(row, "description"),
      size: get(row, "size"),
      layoutOrder: get(row, "layoutorder"),
      isShared: get(row, "isshared"),
      sharedFromGraphId: get(row, "sharedfromgraphid"),
      config: get(row, "config"),
      createdAt: get(row, "createdat"),
      updatedAt: get(row, "updatedat"),
    }),
  },
];

async function verifyTable(check) {
  const sqliteRowsRaw = sqlite.prepare(check.sqliteQuery).all();
  const pgRowsRaw = (await pg.query(check.pgQuery)).rows;

  const sqliteRows = normalizeRows(sqliteRowsRaw, check.mapSqlite);
  const pgRows = normalizeRows(pgRowsRaw, check.mapPg);

  const sqliteMap = new Map(
    sqliteRows.map((row) => [check.keyFields.map((field) => row[field] ?? "").join("|"), row])
  );
  const pgMap = new Map(
    pgRows.map((row) => [check.keyFields.map((field) => row[field] ?? "").join("|"), row])
  );

  let ok = true;

  for (const [key, left] of sqliteMap.entries()) {
    const right = pgMap.get(key);
    if (!right) {
      console.error(`[verify-content] MISMATCH ${check.table}: key ${key} missing in postgres`);
      ok = false;
      continue;
    }

    if (JSON.stringify(left) !== JSON.stringify(right)) {
      console.error(`[verify-content] MISMATCH ${check.table}: key ${key} value mismatch`);
      ok = false;
    }
  }

  if (strictMode) {
    for (const key of pgMap.keys()) {
      if (!sqliteMap.has(key)) {
        console.error(`[verify-content] MISMATCH ${check.table}: extra key in postgres ${key}`);
        ok = false;
      }
    }
  }

  if (ok) {
    const sqliteFingerprint = fingerprintRows(sqliteRows, check.keyFields);
    const pgComparableRows = strictMode
      ? pgRows
      : pgRows.filter((row) => sqliteMap.has(check.keyFields.map((field) => row[field] ?? "").join("|")));
    const pgFingerprint = fingerprintRows(pgComparableRows, check.keyFields);

    if (sqliteFingerprint === pgFingerprint) {
      const mode = strictMode ? "strict" : "backfill-safe";
      const extra = pgRows.length - sqliteRows.length;
      const extraMsg = !strictMode && extra > 0 ? ` (+${extra} extra row(s) in postgres)` : "";
      console.log(
        `[verify-content] OK ${check.table}: ${sqliteRows.length} sqlite row(s) matched (${mode})${extraMsg}`
      );
      return true;
    }
  }

  if (!ok) {
    return false;
  }

  console.error(
    `[verify-content] MISMATCH ${check.table}: sqlite=${sqliteRows.length} postgres=${pgRows.length}`
  );
  const allKeys = new Set([...sqliteMap.keys(), ...pgMap.keys()]);
  for (const key of allKeys) {
    const left = sqliteMap.get(key);
    const right = pgMap.get(key);
    if (!left || !right) {
      console.error(`[verify-content] key ${key}: missing ${!left ? "sqlite" : "postgres"}`);
      continue;
    }

    if (JSON.stringify(left) !== JSON.stringify(right)) {
      console.error(`[verify-content] key ${key}: value mismatch`);
      break;
    }
  }

  return false;
}

async function main() {
  console.log(`[verify-content] SQLite source: ${sqlitePath}`);
  console.log(`[verify-content] mode: ${strictMode ? "strict" : "backfill-safe"}`);
  let ok = true;

  for (const check of checks) {
    const result = await verifyTable(check);
    if (!result) ok = false;
  }

  if (!ok) {
    console.error("[verify-content] Differences detected");
    process.exitCode = 2;
    return;
  }

  console.log("[verify-content] All checked tables validated");
}

main()
  .catch((error) => {
    console.error("[verify-content] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    sqlite.close();
    await pg.end();
  });
