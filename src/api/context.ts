import { defaultCacheTtl, readLocalCache, writeLocalCache } from '../cache'
import type { OpenurpDepartment, OpenurpProject } from '../types'
import { OpenurpApiClient } from './request'

export interface ContextApiOptions {
  apiBaseUrl?: string
  cache?: boolean
  cacheTtl?: number
  headers?: HeadersInit
  fetcher?: typeof fetch
}

const projectStorageKey = 'openurp.project.id'
const projectCacheKey = 'openurp.cache.context.projects'
const departmentCachePrefix = 'openurp.cache.context.departments'
const contextCacheVersion = 2
const inFlightRequests = new Map<string, Promise<unknown>>()

export function getStoredProjectId() {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(projectStorageKey) || ''
}

export function setStoredProjectId(projectId: string | number) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(projectStorageKey, String(projectId))
}

export function clearStoredProjectId() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(projectStorageKey)
}

export function contextDepartmentCacheKey(projectId: string | number) {
  return `${departmentCachePrefix}.${projectId}`
}

export async function listContextProjects(options: ContextApiOptions = {}) {
  return listCachedContextResource<OpenurpProject>({
    cacheKey: projectCacheKey,
    requestKey: 'context:projects',
    resource: 'context.projects',
    path: '/api/base/context/projects.json',
    normalize: normalizeProjects,
    options,
  })
}

export async function getCurrentProjectId(options: ContextApiOptions = {}) {
  const storedProjectId = getStoredProjectId()
  if (storedProjectId) return storedProjectId

  const projects = await listContextProjects(options)
  const project = projects[0]
  if (!project) return ''

  setStoredProjectId(project.id)
  return String(project.id)
}

export async function listContextDepartments(projectId?: string | number, options: ContextApiOptions = {}) {
  const currentProjectId = projectId || await getCurrentProjectId(options)
  if (!currentProjectId) return []

  return listCachedContextResource<OpenurpDepartment>({
    cacheKey: contextDepartmentCacheKey(currentProjectId),
    requestKey: `context:departments:${currentProjectId}`,
    resource: 'context.departments',
    projectId: currentProjectId,
    path: '/api/base/context/departments.json',
    normalize: normalizeDepartments,
    options,
  })
}

async function listCachedContextResource<T>(params: {
  cacheKey: string
  requestKey: string
  resource: string
  projectId?: string | number
  path: string
  normalize: (payload: unknown) => T[]
  options: ContextApiOptions
}) {
  const cacheEnabled = params.options.cache !== false
  const cached = cacheEnabled ? readLocalCache<T>(params.cacheKey) : { entry: null, expired: true }

  const cachedEntry = cached.entry?.version === contextCacheVersion ? cached.entry : null

  if (cachedEntry && !cached.expired) return cachedEntry.items

  const existing = inFlightRequests.get(params.requestKey) as Promise<T[]> | undefined
  if (existing) return existing

  const request = fetchContextResource(params.path, params.options)
    .then((payload) => {
      const items = params.normalize(payload)
      if (cacheEnabled) {
        const now = Date.now()
        writeLocalCache(params.cacheKey, {
          version: contextCacheVersion,
          projectId: params.projectId,
          resource: params.resource,
          fetchedAt: now,
          expiresAt: now + (params.options.cacheTtl ?? defaultCacheTtl),
          items,
        })
      }
      return items
    })
    .catch((error) => {
      if (cachedEntry) return cachedEntry.items
      throw error
    })
    .finally(() => inFlightRequests.delete(params.requestKey))

  inFlightRequests.set(params.requestKey, request)
  return request
}

function fetchContextResource(path: string, options: ContextApiOptions) {
  const client = new OpenurpApiClient({
    baseUrl: options.apiBaseUrl,
    headers: options.headers,
    fetcher: options.fetcher,
  })
  return client.request<unknown>(path)
}

function normalizeProjects(payload: unknown) {
  return normalizeNamedItems(payload) as OpenurpProject[]
}

function normalizeDepartments(payload: unknown) {
  return normalizeNamedItems(payload) as OpenurpDepartment[]
}

function normalizeNamedItems(payload: unknown) {
  const source = unwrapNamedItemsPayload(payload)
  const list = Array.isArray(source) ? source : source ? [source] : []
  return list.map((item) => {
    const source = item as {
      id?: string | number
      code?: string
      name?: string
      shortName?: string
      attributes?: Record<string, unknown>
    }
    const attributes = source.attributes || {}
    const id = source.id ?? attributes.id
    const code = source.code ?? attributes.code
    const name = source.name ?? attributes.name
    const shortName = source.shortName ?? attributes.shortName

    return {
      id: normalizeId(id) ?? normalizeId(code) ?? normalizeId(name) ?? '',
      code: code === undefined || code === null ? undefined : String(code),
      name: name === undefined || name === null ? '' : String(name),
      shortName: shortName === undefined || shortName === null ? undefined : String(shortName),
    }
  })
}

function unwrapNamedItemsPayload(payload: unknown): unknown {
  if (Array.isArray(payload) && payload.length === 1 && Array.isArray(payload[0])) return payload[0]
  const data = (payload as { data?: unknown })?.data
  if (Array.isArray(data) && data.length === 1 && Array.isArray(data[0])) return data[0]
  return data ?? payload
}

function normalizeId(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}
