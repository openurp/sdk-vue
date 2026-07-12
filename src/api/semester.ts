import { defaultCacheTtl, readLocalCache, writeLocalCache } from '../cache'
import { OpenurpApiClient } from './request'
import type { Semester } from '../types'

export interface SemesterApiOptions {
  apiBaseUrl?: string
  filter?: string
  cache?: boolean
  cacheTtl?: number
  headers?: HeadersInit
  fetcher?: typeof fetch
}

const inFlightRequests = new Map<string, Promise<Semester[]>>()

export function semesterCacheKey(projectId: string | number) {
  return semesterCacheKeyWithFilter(projectId, 'active')
}

export function semesterCacheKeyWithFilter(projectId: string | number, filter = 'active') {
  return `openurp.cache.semesters.${projectId}.${filter || 'all'}`
}

export async function listSemesters(projectId: string | number, options: SemesterApiOptions = {}) {
  const filter = options.filter ?? 'active'
  const cacheEnabled = options.cache !== false
  const cacheKey = semesterCacheKeyWithFilter(projectId, filter)
  const cached = cacheEnabled ? readLocalCache<Semester>(cacheKey) : { entry: null, expired: true }

  if (cached.entry && !cached.expired) return cached.entry.items

  const requestKey = `${projectId}:${filter}`
  const existing = inFlightRequests.get(requestKey)
  if (existing) return existing

  const request = fetchSemesters(projectId, options)
    .then((items) => {
      if (cacheEnabled) {
        const now = Date.now()
        writeLocalCache(cacheKey, {
          version: 1,
          projectId,
          resource: 'semesters',
          fetchedAt: now,
          expiresAt: now + (options.cacheTtl ?? defaultCacheTtl),
          items,
        })
      }
      return items
    })
    .catch((error) => {
      if (cached.entry) return cached.entry.items
      throw error
    })
    .finally(() => inFlightRequests.delete(requestKey))

  inFlightRequests.set(requestKey, request)
  return request
}

function fetchSemesters(projectId: string | number, options: SemesterApiOptions = {}) {
  const client = new OpenurpApiClient({
    baseUrl: options.apiBaseUrl,
    headers: options.headers,
    fetcher: options.fetcher,
  })
  return client.request<Semester[]>(`/api/base/semesters/${projectId}.json`, {
    query: {
      filter: options.filter ?? 'active',
    },
  })
}
