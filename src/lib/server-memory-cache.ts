type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

type GlobalCache = typeof globalThis & {
  __costockageMemoryCache?: Map<string, CacheEntry>;
};

function getCacheMap() {
  const globalCache = globalThis as GlobalCache;
  if (!globalCache.__costockageMemoryCache) {
    globalCache.__costockageMemoryCache = new Map<string, CacheEntry>();
  }
  return globalCache.__costockageMemoryCache;
}

export async function getOrSetMemoryCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const map = getCacheMap();
  const existing = map.get(key);
  const now = Date.now();

  if (existing && existing.expiresAt > now) {
    return existing.value as T;
  }

  const value = await loader();
  map.set(key, {
    value,
    expiresAt: now + Math.max(0, ttlMs),
  });

  return value;
}

export function clearMemoryCacheByPrefix(prefix: string) {
  const map = getCacheMap();
  for (const key of map.keys()) {
    if (key.startsWith(prefix)) {
      map.delete(key);
    }
  }
}
