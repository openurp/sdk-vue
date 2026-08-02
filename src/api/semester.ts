import { defaultCacheTtl, readLocalCache, writeLocalCache } from '../cache'
import { OpenurpApiClient, OpenurpApiError } from './request'
import type { Semester } from '../types'

export interface SemesterApiOptions {
  apiBaseUrl?: string
  filter?: string
  cache?: boolean
  cacheTtl?: number
  headers?: HeadersInit
  fetcher?: typeof fetch
}

/** Learning API root for student-facing std endpoints. */
export const LEARNING_API_PREFIX = '/api/edu/learning'

/** Relative student semester JSON:API path (`?student.id=` is added by helpers). */
export const STUDENT_SEMESTERS_PATH = '/std/semesters.jsonapi'

/** Full path: `/api/edu/learning/std/semesters.jsonapi`. */
export const STUDENT_SEMESTERS_JSONAPI_PATH = `${LEARNING_API_PREFIX}${STUDENT_SEMESTERS_PATH}`

export interface StudentSemesterApiOptions {
  apiBaseUrl?: string
  headers?: HeadersInit
  fetcher?: typeof fetch
  /**
   * Optional app-level URL composer (e.g. runtime `getApiUrl`).
   * When set, the path is composed through it before appending `student.id`.
   */
  composeUrl?: (path: string, urpSid?: string | null) => string
  urpSid?: string | null
}

/**
 * Build `/api/edu/learning/std/semesters.jsonapi?student.id={studentId}`
 * (plus URP_SID when composed via `composeUrl` / cross-origin client).
 */
export function getStudentSemestersUrl(
  studentId: string | number,
  options: StudentSemesterApiOptions = {},
): string {
  const id = String(studentId)
  if (options.composeUrl) {
    const base = options.composeUrl(STUDENT_SEMESTERS_JSONAPI_PATH, options.urpSid)
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}student.id=${encodeURIComponent(id)}`
  }

  const client = new OpenurpApiClient({
    baseUrl: options.apiBaseUrl,
    headers: options.headers,
    fetcher: options.fetcher,
  })
  return client.resolveUrl(STUDENT_SEMESTERS_JSONAPI_PATH, { 'student.id': id })
}

/** Fetch the raw JSON:API payload for a student's enrollment semesters. */
export async function fetchStudentSemestersJsonApi(
  studentId: string | number,
  options: StudentSemesterApiOptions = {},
): Promise<unknown> {
  if (options.composeUrl) {
    const url = getStudentSemestersUrl(studentId, options)
    const fetcher = options.fetcher ?? ((input, init) => globalThis.fetch(input, init))
    const headers = new Headers({ Accept: 'application/vnd.api+json' })
    new Headers(options.headers).forEach((value, key) => headers.set(key, value))
    const response = await fetcher(url, {
      method: 'GET',
      credentials: 'include',
      headers,
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new OpenurpApiError(response.status, response.statusText)
    }
    return response.json()
  }

  const client = new OpenurpApiClient({
    baseUrl: options.apiBaseUrl,
    headers: options.headers,
    fetcher: options.fetcher,
  })
  return client.request(STUDENT_SEMESTERS_JSONAPI_PATH, {
    query: { 'student.id': studentId },
    headers: { Accept: 'application/vnd.api+json' },
    cache: 'no-store',
  })
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
