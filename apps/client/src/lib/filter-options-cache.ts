/**
 * Session-level cache for filter dropdown options so region/subcity/sector
 * selects don't re-spin on every page visit.
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const TTL_MS = 30 * 60_000;
const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function isFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return Boolean(entry && entry.expiresAt > Date.now());
}

export function peekFilterOptionsCache<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  return isFresh(entry) ? entry.value : null;
}

export async function getCachedFilterOptions<T>(key: string, loader: () => Promise<T>, ttlMs = TTL_MS): Promise<T> {
  const hit = store.get(key) as CacheEntry<T> | undefined;
  if (isFresh(hit)) return hit.value;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = loader()
    .then((value) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      inflight.delete(key);
      return value;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}

export function clearFilterOptionsCache(key?: string) {
  if (key) {
    store.delete(key);
    inflight.delete(key);
    return;
  }
  store.clear();
  inflight.clear();
}
