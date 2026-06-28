import { defaultCacheTtl, readLocalCache, writeLocalCache } from '../cache'
import { OpenurpApiClient } from './request'
import type { Semester } from '../types'

export interface SemesterApiOptions {
  apiBaseUrl?: string
  cache?: boolean
  cacheTtl?: number
  headers?: HeadersInit
  fetcher?: typeof fetch
}

const inFlightRequests = new Map<string, Promise<Semester[]>>()

export function semesterCacheKey(projectId: string | number) {
  return `openurp.cache.semesters.${projectId}`
}

export async function listSemesters(projectId: string | number, options: SemesterApiOptions = {}) {
  const cacheEnabled = options.cache !== false
  const cacheKey = semesterCacheKey(projectId)
  const cached = cacheEnabled ? readLocalCache<Semester>(cacheKey) : { entry: null, expired: true }

  if (cached.entry && !cached.expired) return cached.entry.items

  const requestKey = String(projectId)
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
  return client.request<Semester[]>(`/api/base/semesters/${projectId}.json`)
}
