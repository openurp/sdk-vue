import { describe, expect, it, vi } from 'vitest'
import { loadOpenurpRuntimeConfigs, openurpThemeConfigPath } from '../src/api/runtimeConfig'

const ok = (body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))

describe('loadOpenurpRuntimeConfigs', () => {
  it('加载 appConfig 与默认主题配置', async () => {
    const appFetcher = ok({ ems_base: 'http://ems.example.com' })
    const themeFetcher = ok({ primaryColor: '#fff' })
    let themeUrl = ''
    const fetcher = vi.fn(async (input: string) => {
      if (input.includes('/configs.json')) return appFetcher(input)
      themeUrl = input
      return themeFetcher(input)
    })

    const result = await loadOpenurpRuntimeConfigs({
      appConfigPath: '/api/edu/learning/configs.json',
      apiBaseUrl: 'http://api.example.com',
      fetcher: fetcher as unknown as typeof fetch,
    })
    expect(result.appConfig).toEqual({ ems_base: 'http://ems.example.com' })
    expect(result.themeConfig).toEqual({ primaryColor: '#fff' })
    expect(themeUrl).toBe(`http://api.example.com${openurpThemeConfigPath}`)
  })

  it('themeConfigPath 为 null 时跳过主题加载', async () => {
    const calls: string[] = []
    const fetcher = vi.fn(async (input: string) => {
      calls.push(input)
      return new Response(JSON.stringify({}), { status: 200 })
    })

    const result = await loadOpenurpRuntimeConfigs({
      appConfigPath: '/api/edu/learning/configs.json',
      apiBaseUrl: 'http://api.example.com',
      themeConfigPath: null,
      fetcher: fetcher as unknown as typeof fetch,
    })
    expect(result.themeConfig).toBeNull()
    expect(calls).toEqual(['http://api.example.com/api/edu/learning/configs.json'])
  })

  it('非 2xx 时降级为 null 且不告警', async () => {
    const warn = vi.fn()
    const fetcher = vi.fn(async () => new Response('', { status: 500 }))
    const result = await loadOpenurpRuntimeConfigs({
      appConfigPath: '/configs.json',
      apiBaseUrl: 'http://api.example.com',
      fetcher: fetcher as unknown as typeof fetch,
      warn,
    })
    expect(result.appConfig).toBeNull()
    expect(warn).not.toHaveBeenCalled()
  })

  it('网络异常时降级为 null 并告警', async () => {
    const warn = vi.fn()
    const fetcher = vi.fn(async () => {
      throw new Error('network down')
    })
    const result = await loadOpenurpRuntimeConfigs({
      appConfigPath: '/configs.json',
      apiBaseUrl: 'http://api.example.com',
      fetcher: fetcher as unknown as typeof fetch,
      warn,
    })
    expect(result.appConfig).toBeNull()
    expect(warn).toHaveBeenCalled()
  })
})
