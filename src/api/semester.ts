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

/**
 * 学生学年学期相对路径（`?student.id=` 由辅助函数追加）。
 * 配合应用的 `apiBasePath`（或 `composeUrl`）组成完整接口路径，
 * 例如 learning 为 `/api/edu/learning/std/semesters.jsonapi`。
 */
export const STUDENT_SEMESTERS_PATH = '/std/semesters.jsonapi'

export interface StudentSemesterApiOptions {
  apiBaseUrl?: string
  /**
   * 应用 API 基础路径前缀（如 learning 的 `/api/edu/learning`），
   * 与 `STUDENT_SEMESTERS_PATH` 拼接得到完整接口路径。
   */
  apiBasePath?: string
  headers?: HeadersInit
  fetcher?: typeof fetch
  /**
   * Optional app-level URL composer (e.g. runtime `getApiUrl`).
   * When set, the path is composed through it before appending `student.id`.
   */
  composeUrl?: (path: string, urpSid?: string | null) => string
  urpSid?: string | null
}

/** 学生学年学期完整接口路径：`{apiBasePath}/std/semesters.jsonapi`。 */
function studentSemestersPath(options: StudentSemesterApiOptions): string {
  const prefix = (options.apiBasePath || '').trim().replace(/\/+$/, '')
  return `${prefix}${STUDENT_SEMESTERS_PATH}`
}

/**
 * Build `{apiBasePath}/std/semesters.jsonapi?student.id={studentId}`
 * (plus URP_SID when composed via `composeUrl` / cross-origin client).
 */
export function getStudentSemestersUrl(
  studentId: string | number,
  options: StudentSemesterApiOptions = {},
): string {
  const id = String(studentId)
  const path = studentSemestersPath(options)
  if (options.composeUrl) {
    const base = options.composeUrl(path, options.urpSid)
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}student.id=${encodeURIComponent(id)}`
  }

  const client = new OpenurpApiClient({
    baseUrl: options.apiBaseUrl,
    headers: options.headers,
    fetcher: options.fetcher,
  })
  return client.resolveUrl(path, { 'student.id': id })
}

/** Fetch the raw JSON:API payload for a student's enrollment semesters. */
export async function fetchStudentSemestersJsonApi(
  studentId: string | number,
  options: StudentSemesterApiOptions = {},
): Promise<unknown> {
  const path = studentSemestersPath(options)
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
  return client.request(path, {
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

const SEMESTER_CACHE_VERSION = 1

export async function listSemesters(projectId: string | number, options: SemesterApiOptions = {}) {
  const filter = options.filter ?? 'active'
  const cacheEnabled = options.cache !== false
  const cacheKey = semesterCacheKeyWithFilter(projectId, filter)
  const cached = cacheEnabled ? readLocalCache<Semester>(cacheKey) : { entry: null, expired: true }

  // 校验缓存 schema 版本，避免升级后消费旧版本写入的脏数据。
  if (cached.entry?.version === SEMESTER_CACHE_VERSION && !cached.expired) return cached.entry.items

  const requestKey = `${projectId}:${filter}`
  const existing = inFlightRequests.get(requestKey)
  if (existing) return existing

  const request = fetchSemesters(projectId, options)
    .then((items) => {
      if (cacheEnabled) {
        const now = Date.now()
        writeLocalCache(cacheKey, {
          version: SEMESTER_CACHE_VERSION,
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
      if (cached.entry?.version === SEMESTER_CACHE_VERSION) return cached.entry.items
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
