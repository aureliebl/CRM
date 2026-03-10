import { Pool, type PoolConfig } from "pg";

type GlobalPools = typeof globalThis & {
  __costockageSharedPgPools?: Map<string, Pool>;
};

function buildPoolKey(config: PoolConfig) {
  return JSON.stringify({
    connectionString: config.connectionString ?? "",
    host: config.host ?? "",
    port: config.port ?? "",
    database: config.database ?? "",
    user: config.user ?? "",
    ssl: Boolean(config.ssl),
    max: config.max ?? "",
    min: config.min ?? "",
    connectionTimeoutMillis: config.connectionTimeoutMillis ?? "",
    idleTimeoutMillis: config.idleTimeoutMillis ?? "",
  });
}

export function getSharedPgPool(config: PoolConfig) {
  const globalPools = globalThis as GlobalPools;
  if (!globalPools.__costockageSharedPgPools) {
    globalPools.__costockageSharedPgPools = new Map<string, Pool>();
  }

  const key = buildPoolKey(config);
  const existing = globalPools.__costockageSharedPgPools.get(key);
  if (existing) return existing;

  const pool = new Pool(config);
  globalPools.__costockageSharedPgPools.set(key, pool);
  return pool;
}
