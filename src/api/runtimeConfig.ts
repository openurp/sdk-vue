import { setOpenurpApiBaseUrl } from './request'

export interface OpenurpRuntimeConfigPayload {
  ems_base?: string
  cas_base?: string
  cas_auth_login_url?: string
  cas_login_url?: string
  cas_logout_url?: string
  /** Domain / org logo for SPA shell brand (e.g. from configs.json). */
  logoUrl?: string
}

export interface OpenurpThemeConfigPayload {
  searchBgColor?: string
  navbarBgColor?: string
  primaryColor?: string
  gridbarBgColor?: string
  gridBorderColor?: string
  [key: string]: unknown
}

export interface OpenurpDomainOrgConfig {
  code?: string | number
  name?: string
  id?: number
  shortName?: string
  wwwUrl?: string
  logoUrl?: string
}

/**
 * 应用域信息（来自平台 `domains.json`）。
 * `title` 可作为系统名，`logoUrl` 可作为品牌 logo。
 */
export interface OpenurpDomainConfigPayload {
  hostname?: string
  org?: OpenurpDomainOrgConfig
  name?: string
  id?: number
  title?: string
  logoUrl?: string
}

export interface OpenurpRuntimeConfigOptions {
  appBasePath: string
  apiBaseUrl?: string
  casBaseUrl?: string
  casAuthLoginUrl?: string
  casLoginUrl?: string
  casLogoutUrl?: string
}

export interface LoadOpenurpRuntimeConfigsOptions {
  appConfigPath?: string
  apiBaseUrl?: string
  themeConfigPath?: string
  fetcher?: typeof fetch
  warn?: (message: string, error: unknown) => void
}

export interface LoadedOpenurpRuntimeConfigs {
  appConfig: OpenurpRuntimeConfigPayload | null
  themeConfig: OpenurpThemeConfigPayload | null
}

export interface OpenurpRuntimeConfig {
  readonly appBasePath: string
  readonly apiBaseUrl: string
  readonly emsBaseUrl: string
  readonly logoUrl: string
  readonly domainConfig: OpenurpDomainConfigPayload | null
  readonly appTitle: string
  readonly themeConfig: OpenurpThemeConfigPayload | null
  readonly casServerBaseUrl: string
  readonly casAuthLoginUrl: string
  readonly casLoginUrl: string
  readonly casLogoutUrl: string
  applyConfig(config: OpenurpRuntimeConfigPayload): void
  setApiBaseUrl(url: string): void
  setEmsBaseUrl(url: string): void
  setCasBaseUrl(url: string): void
  setCasUrls(config: OpenurpRuntimeConfigPayload): void
  setLogoUrl(url: string): void
  setDomainConfig(config: OpenurpDomainConfigPayload | null): void
  setThemeConfig(config: OpenurpThemeConfigPayload | null): void
  getApiUrl(path: string, urpSid?: string | null): string
  getCasUrl(path: string): string
  getCasAuthLoginUrl(): string
  getCasLoginUrl(): string
  getCasLogoutUrl(): string
  isCrossOriginUrl(url: string): boolean
}

export const openurpThemeConfigPath = '/api/platform/config/themes.json'
export const openurpDomainsConfigPath = '/api/platform/config/domains.json'

export async function loadOpenurpRuntimeConfigs(options: LoadOpenurpRuntimeConfigsOptions = {}): Promise<LoadedOpenurpRuntimeConfigs> {
  const fetcher = options.fetcher ?? ((input, init) => globalThis.fetch(input, init))
  const apiBaseUrl = normalizeUrl(options.apiBaseUrl || getCurrentOrigin())
  const result: LoadedOpenurpRuntimeConfigs = {
    appConfig: null,
    themeConfig: null,
  }

  if (options.appConfigPath) {
    try {
      result.appConfig = await fetchJson<OpenurpRuntimeConfigPayload>(fetcher, joinUrl(apiBaseUrl, options.appConfigPath))
    } catch (error) {
      options.warn?.('运行时配置加载失败，继续使用构建配置', error)
    }
  }

  try {
    result.themeConfig = await fetchJson<OpenurpThemeConfigPayload>(fetcher, joinUrl(apiBaseUrl, options.themeConfigPath || openurpThemeConfigPath))
  } catch (error) {
    options.warn?.('平台主题配置加载失败，继续使用默认主题', error)
  }

  return result
}

export interface LoadOpenurpDomainConfigOptions {
  emsBaseUrl?: string
  fetcher?: typeof fetch
  warn?: (message: string, error: unknown) => void
}

/**
 * 从平台加载当前应用的域信息：`{emsBase}/api/platform/config/domains.json`。
 * 返回的 `title` 可作为系统名，`logoUrl` 可作为品牌 logo。
 * 加载失败返回 null，不抛异常。
 */
export async function loadOpenurpDomainConfig(options: LoadOpenurpDomainConfigOptions = {}): Promise<OpenurpDomainConfigPayload | null> {
  const fetcher = options.fetcher ?? ((input, init) => globalThis.fetch(input, init))
  const baseUrl = normalizeUrl(options.emsBaseUrl || getCurrentOrigin())
  try {
    return await fetchJson<OpenurpDomainConfigPayload>(fetcher, joinUrl(baseUrl, openurpDomainsConfigPath))
  } catch (error) {
    options.warn?.('平台域名配置加载失败，使用本地系统名', error)
    return null
  }
}

export function createOpenurpRuntimeConfig(options: OpenurpRuntimeConfigOptions): OpenurpRuntimeConfig {
  let apiBaseUrl = normalizeUrl(options.apiBaseUrl || getCurrentOrigin())
  let emsBaseUrl = apiBaseUrl
  let logoUrl = ''
  let domainConfig: OpenurpDomainConfigPayload | null = null
  let themeConfig: OpenurpThemeConfigPayload | null = null
  let casServerBaseUrl = normalizeUrl(options.casBaseUrl || '')
  let casAuthLoginUrl = options.casAuthLoginUrl || ''
  let casLoginUrl = options.casLoginUrl || ''
  let casLogoutUrl = options.casLogoutUrl || ''

  const runtimeConfig: OpenurpRuntimeConfig = {
    get appBasePath() {
      return options.appBasePath
    },

    get apiBaseUrl() {
      return apiBaseUrl
    },

    get emsBaseUrl() {
      return emsBaseUrl
    },

    get logoUrl() {
      return logoUrl
    },

    get domainConfig() {
      return domainConfig
    },

    get appTitle() {
      return domainConfig?.title || ''
    },

    get themeConfig() {
      return themeConfig
    },

    get casServerBaseUrl() {
      return casServerBaseUrl
    },

    get casAuthLoginUrl() {
      return casAuthLoginUrl
    },

    get casLoginUrl() {
      return casLoginUrl
    },

    get casLogoutUrl() {
      return casLogoutUrl
    },

    applyConfig(config: OpenurpRuntimeConfigPayload): void {
      if (config.ems_base) runtimeConfig.setEmsBaseUrl(config.ems_base)
      if (config.logoUrl) runtimeConfig.setLogoUrl(config.logoUrl)
      else if (domainConfig?.logoUrl) runtimeConfig.setLogoUrl(domainConfig.logoUrl)
      runtimeConfig.setCasUrls(config)
    },

    setApiBaseUrl(url: string): void {
      apiBaseUrl = normalizeUrl(url || getCurrentOrigin())
    },

    setEmsBaseUrl(url: string): void {
      emsBaseUrl = normalizeUrl(url)
      if (!options.casBaseUrl) casServerBaseUrl = joinUrl(emsBaseUrl, '/cas')
    },

    setCasBaseUrl(url: string): void {
      casServerBaseUrl = normalizeUrl(url)
    },

    setCasUrls(config: OpenurpRuntimeConfigPayload): void {
      if (config.cas_base) runtimeConfig.setCasBaseUrl(config.cas_base)
      if (config.cas_auth_login_url) casAuthLoginUrl = config.cas_auth_login_url
      if (config.cas_login_url) casLoginUrl = config.cas_login_url
      if (config.cas_logout_url) casLogoutUrl = config.cas_logout_url
    },

    setLogoUrl(url: string): void {
      const trimmed = String(url || '').trim()
      logoUrl = /^file:/i.test(trimmed) ? '' : trimmed
    },

    setDomainConfig(config: OpenurpDomainConfigPayload | null): void {
      domainConfig = config
      if (config?.title && !logoUrl && config.logoUrl) {
        runtimeConfig.setLogoUrl(config.logoUrl)
      }
    },

    setThemeConfig(config: OpenurpThemeConfigPayload | null): void {
      themeConfig = config
    },

    getApiUrl(path: string, urpSid?: string | null): string {
      const url = joinUrl(apiBaseUrl, path)
      return appendUrpSidIfNeeded(url, urpSid)
    },

    getCasUrl(path: string): string {
      return joinUrl(casServerBaseUrl || joinUrl(emsBaseUrl, '/cas'), path)
    },

    getCasAuthLoginUrl(): string {
      return casAuthLoginUrl || runtimeConfig.getCasUrl('/auth/login.json')
    },

    getCasLoginUrl(): string {
      return casLoginUrl || runtimeConfig.getCasUrl('/login')
    },

    getCasLogoutUrl(): string {
      return casLogoutUrl || runtimeConfig.getCasUrl('/logout')
    },

    isCrossOriginUrl(url: string): boolean {
      return isCrossOriginUrl(url)
    },
  }

  setOpenurpApiBaseUrl(() => runtimeConfig.apiBaseUrl)
  return runtimeConfig
}

export const normalizeUrl = (url: string): string => url.replace(/\/+$/, '')

export const getCurrentOrigin = (): string => {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

export const joinUrl = (baseUrl: string, path: string): string => {
  if (!baseUrl) return path
  return `${normalizeUrl(baseUrl)}/${path.replace(/^\/+/, '')}`
}

export const isCrossOriginUrl = (url: string): boolean => {
  if (typeof window === 'undefined') return false
  return new URL(url, window.location.origin).origin !== window.location.origin
}

export const appendUrpSidIfNeeded = (url: string, urpSid?: string | null): string => {
  if (!urpSid || !(isCrossOriginUrl(url) || url.startsWith('/'))) return url
  return appendQuery(url, { URP_SID: urpSid })
}

const appendQuery = (url: string, params: Record<string, string>): string => {
  const nextUrl = new URL(url, typeof window === 'undefined' ? 'http://localhost' : window.location.origin)
  Object.entries(params).forEach(([key, value]) => {
    if (value) nextUrl.searchParams.set(key, value)
  })
  return url.startsWith('http') ? nextUrl.toString() : `${nextUrl.pathname}${nextUrl.search}`
}

async function fetchJson<T>(fetcher: typeof fetch, url: string): Promise<T | null> {
  const response = await fetcher(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) return null
  return response.json() as Promise<T>
}
