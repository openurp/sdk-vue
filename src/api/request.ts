export interface OpenurpRequestOptions extends RequestInit {
  query?: Record<string, string | number | boolean | null | undefined>
}

export interface OpenurpApiClientOptions {
  baseUrl?: string
  headers?: HeadersInit
  fetcher?: typeof fetch
}

type RequestHeadersProvider = () => HeadersInit | undefined
type UrpSidProvider = () => string | null | undefined
type ApiBaseUrlProvider = () => string | null | undefined

let requestHeadersProvider: RequestHeadersProvider | undefined
let urpSidProvider: UrpSidProvider | undefined
let apiBaseUrlProvider: ApiBaseUrlProvider | undefined

export function setOpenurpRequestHeaders(provider: RequestHeadersProvider | undefined) {
  requestHeadersProvider = provider
}

export function setOpenurpUrpSid(provider: UrpSidProvider | undefined) {
  urpSidProvider = provider
}

export function setOpenurpApiBaseUrl(provider: ApiBaseUrlProvider | undefined) {
  apiBaseUrlProvider = provider
}

export class OpenurpApiClient {
  private readonly baseUrl: string
  private readonly headers?: HeadersInit
  private readonly fetcher: typeof fetch

  constructor(options: OpenurpApiClientOptions = {}) {
    this.baseUrl = normalizeUrl(options.baseUrl ?? apiBaseUrlProvider?.() ?? getDefaultApiBaseUrl())
    this.headers = options.headers
    this.fetcher = options.fetcher ?? ((input, init) => globalThis.fetch(input, init))
  }

  async request<T>(path: string, options: OpenurpRequestOptions = {}): Promise<T> {
    const { query, headers, ...init } = options
    const response = await this.fetcher(this.buildUrl(path, query), {
      credentials: 'include',
      ...init,
      headers: this.buildHeaders(headers),
    })

    if (!response.ok) {
      throw new OpenurpApiError(response.status, response.statusText)
    }

    return response.json() as Promise<T>
  }

  private buildUrl(path: string, query?: OpenurpRequestOptions['query']) {
    const fallbackOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
    const url = new URL(path, this.baseUrl || fallbackOrigin)

    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    })

    if (!this.baseUrl && path.startsWith('/')) {
      return `${url.pathname}${url.search}${url.hash}`
    }

    const urpSid = urpSidProvider?.()
    if (urpSid && isCrossOrigin(url)) {
      url.searchParams.set('URP_SID', urpSid)
    }

    return url.toString()
  }

  private buildHeaders(headers?: HeadersInit) {
    const result = new Headers({ Accept: 'application/json' })
    new Headers(requestHeadersProvider?.()).forEach((value, key) => result.set(key, value))
    new Headers(this.headers).forEach((value, key) => result.set(key, value))
    new Headers(headers).forEach((value, key) => result.set(key, value))
    return result
  }
}

function getDefaultApiBaseUrl() {
  return import.meta.env?.VITE_API_BASE || ''
}

function normalizeUrl(url: string) {
  return url.replace(/\/+$/, '')
}

function isCrossOrigin(url: URL) {
  if (typeof window === 'undefined') return false
  return url.origin !== window.location.origin
}

export class OpenurpApiError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
  ) {
    super(`OpenURP API request failed: ${status} ${statusText}`)
    this.name = 'OpenurpApiError'
  }
}
