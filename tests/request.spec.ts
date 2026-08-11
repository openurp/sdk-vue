import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenurpApiClient, OpenurpApiError, setOpenurpUrpSid } from '../src/api/request'

afterEach(() => {
  setOpenurpUrpSid(undefined)
})

describe('OpenurpApiClient', () => {
  it('resolveUrl 基于 baseUrl 拼接路径并追加 query', () => {
    const client = new OpenurpApiClient({ baseUrl: 'http://api.example.com' })
    expect(client.resolveUrl('/std/semesters.jsonapi', { 'student.id': 'stu001' })).toBe(
      'http://api.example.com/std/semesters.jsonapi?student.id=stu001',
    )
  })

  it('无 baseUrl 的相对路径返回相对地址，并按需追加 URP_SID', () => {
    const client = new OpenurpApiClient()
    expect(client.resolveUrl('/api/x.json')).toBe('/api/x.json')
    setOpenurpUrpSid(() => 'sid-1')
    expect(client.resolveUrl('/api/x.json')).toBe('/api/x.json?URP_SID=sid-1')
  })

  it('跨域请求追加 URP_SID', () => {
    setOpenurpUrpSid(() => 'sid-2')
    const client = new OpenurpApiClient({ baseUrl: 'http://api.example.com' })
    expect(client.resolveUrl('/api/x.json')).toBe('http://api.example.com/api/x.json?URP_SID=sid-2')
  })

  it('query 忽略 null/undefined', () => {
    const client = new OpenurpApiClient({ baseUrl: 'http://api.example.com' })
    expect(client.resolveUrl('/x.json', { a: '1', b: null, c: undefined })).toBe('http://api.example.com/x.json?a=1')
  })

  it('request 非 2xx 抛出 OpenurpApiError', async () => {
    const client = new OpenurpApiClient({
      baseUrl: 'http://api.example.com',
      fetcher: vi.fn(async () => new Response('', { status: 404 })),
    })
    await expect(client.request('/x.json')).rejects.toBeInstanceOf(OpenurpApiError)
  })

  it('request 成功时返回 JSON', async () => {
    const client = new OpenurpApiClient({
      baseUrl: 'http://api.example.com',
      fetcher: vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    })
    await expect(client.request<{ ok: boolean }>('/x.json')).resolves.toEqual({ ok: true })
  })
})
