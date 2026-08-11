import { describe, expect, it } from 'vitest'
import { defaultCacheTtl, readLocalCache, removeLocalCache, writeLocalCache } from '../src/cache/localCache'

const key = 'openurp.cache.test'

describe('localCache', () => {
  it('写入后可读，未过期返回 items', () => {
    const now = Date.now()
    writeLocalCache(key, {
      version: 1,
      fetchedAt: now,
      expiresAt: now + defaultCacheTtl,
      items: [1, 2],
    })
    const result = readLocalCache<number>(key, now)
    expect(result.expired).toBe(false)
    expect(result.entry?.items).toEqual([1, 2])
  })

  it('过期后标记 expired，并可移除', () => {
    const now = Date.now()
    writeLocalCache(key, {
      version: 1,
      fetchedAt: now - defaultCacheTtl * 2,
      expiresAt: now - defaultCacheTtl,
      items: [1],
    })
    expect(readLocalCache<number>(key, now).expired).toBe(true)
    removeLocalCache(key)
    expect(readLocalCache<number>(key, now).entry).toBeNull()
  })
})
