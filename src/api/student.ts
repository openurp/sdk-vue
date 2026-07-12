import type { Student } from '../types'
import { OpenurpApiClient } from './request'

export interface StudentApiOptions {
  apiBaseUrl?: string
  headers?: HeadersInit
  fetcher?: typeof fetch
}

export async function searchStudents(projectId: string | number, query: string, options: StudentApiOptions = {}): Promise<Student[]> {
  const keyword = query.trim()
  if (!keyword) return []

  const client = new OpenurpApiClient({
    baseUrl: options.apiBaseUrl,
    headers: options.headers,
    fetcher: options.fetcher,
  })
  const payload = await client.request<unknown>(`/api/base/std/${projectId}/students.json`, {
    query: { q: keyword },
  })
  return normalizeStudents(payload)
}

export function normalizeStudents(payload: unknown): Student[] {
  if (!Array.isArray(payload)) return []
  return payload.map(normalizeStudent).filter((student) => student.id && student.code)
}

function normalizeStudent(item: unknown): Student {
  const source = item as Partial<Student>
  const code = normalizeString(source.code)
  const name = normalizeString(source.name)
  const description = normalizeString(source.description) || [code, name].filter(Boolean).join(' ')
  return {
    id: normalizeString(source.id) || code || name,
    code,
    name,
    shortName: normalizeString(source.shortName) || undefined,
    description,
  }
}

function normalizeString(value: unknown) {
  return value === undefined || value === null ? '' : String(value)
}
