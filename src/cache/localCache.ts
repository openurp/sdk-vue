export interface LocalCacheEntry<T> {
  version: number
  projectId?: string | number
  resource: string
  code?: string
  fetchedAt: number
  expiresAt: number
  items: T[]
}

export interface CacheReadResult<T> {
  entry: LocalCacheEntry<T> | null
  expired: boolean
}

export const defaultCacheTtl = 7 * 24 * 60 * 60 * 1000

export function readLocalCache<T>(key: string, now = Date.now()): CacheReadResult<T> {
  if (typeof localStorage === 'undefined') return { entry: null, expired: true }
  const raw = localStorage.getItem(key)
  if (!raw) return { entry: null, expired: true }

  try {
    const entry = JSON.parse(raw) as LocalCacheEntry<T>
    if (!Array.isArray(entry.items)) return { entry: null, expired: true }
    return {
      entry,
      expired: !entry.expiresAt || entry.expiresAt <= now,
    }
  } catch {
    localStorage.removeItem(key)
    return { entry: null, expired: true }
  }
}

export function writeLocalCache<T>(key: string, entry: LocalCacheEntry<T>) {
  if (typeof localStorage === 'undefined') return false
  try {
    localStorage.setItem(key, JSON.stringify(entry))
    return true
  } catch {
    return false
  }
}

export function removeLocalCache(key: string) {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(key)
}
