import { defaultCacheTtl, readLocalCache, writeLocalCache } from '../cache'
import type { CodeItem } from '../types'
import { OpenurpApiClient } from './request'

export interface CodeApiOptions {
  apiBaseUrl?: string
  cache?: boolean
  cacheTtl?: number
  headers?: HeadersInit
  fetcher?: typeof fetch
}

const inFlightRequests = new Map<string, Promise<CodeItem[]>>()

export function codeCacheKey(projectId: string | number, code: string) {
  return `openurp.cache.dict.${code}.${projectId}`
}

export async function listCodeItems(projectId: string | number, code: string, options: CodeApiOptions = {}) {
  const cacheEnabled = options.cache !== false
  const cacheKey = codeCacheKey(projectId, code)
  const cached = cacheEnabled ? readLocalCache<CodeItem>(cacheKey) : { entry: null, expired: true }

  if (cached.entry && !cached.expired) return cached.entry.items

  const requestKey = `${projectId}:${code}`
  const existing = inFlightRequests.get(requestKey)
  if (existing) return existing

  const request = fetchCodeItems(projectId, code, options)
    .then((items) => {
      if (cacheEnabled) {
        const now = Date.now()
        writeLocalCache(cacheKey, {
          version: 1,
          projectId,
          resource: 'dict',
          code,
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

async function fetchCodeItems(projectId: string | number, code: string, options: CodeApiOptions) {
  const client = new OpenurpApiClient({
    baseUrl: options.apiBaseUrl,
    headers: options.headers,
    fetcher: options.fetcher,
  })
  const payload = await client.request<unknown>(`/api/base/code/${projectId}/${code}.json`)
  return normalizeCodeItems(payload)
}

export function normalizeCodeItems(payload: unknown): CodeItem[] {
  if (Array.isArray(payload)) return payload.map(normalizeCodeItem)

  const data = (payload as { data?: unknown })?.data
  if (Array.isArray(data)) return data.map(normalizeCodeItem)

  return []
}

function normalizeCodeItem(item: unknown): CodeItem {
  const source = item as {
    id?: string | number
    code?: string
    name?: string
    shortName?: string
    enName?: string
    enabled?: boolean
    remark?: string
    attributes?: Record<string, unknown>
  }
  const attributes = source.attributes || {}
  const id = source.id ?? attributes.id
  const code = source.code ?? attributes.code
  const name = source.name ?? attributes.name
  const shortName = source.shortName ?? attributes.shortName
  const enName = source.enName ?? attributes.enName
  const enabled = source.enabled ?? attributes.enabled
  const remark = source.remark ?? attributes.remark
  const normalizedId = normalizeId(id) ?? normalizeId(code) ?? normalizeId(name) ?? ''

  return {
    id: normalizedId,
    code: code === undefined || code === null ? undefined : String(code),
    name: name === undefined || name === null ? '' : String(name),
    shortName: shortName === undefined || shortName === null ? undefined : String(shortName),
    enName: enName === undefined || enName === null ? undefined : String(enName),
    enabled: typeof enabled === 'boolean' ? enabled : undefined,
    remark: remark === undefined || remark === null ? undefined : String(remark),
  }
}

function normalizeId(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}
