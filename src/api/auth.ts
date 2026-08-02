import { onMounted, ref, type Ref } from 'vue'
import { setOpenurpUrpSid } from './request'

export interface OpenurpCurrentUser {
  name: string
  code: string
}

export interface CasUserResponse<TUser extends OpenurpCurrentUser = OpenurpCurrentUser> {
  authenticated?: boolean
  success?: boolean
  user?: TUser
  token?: string
  redirectUrl?: string
  error?: string
}

export interface AuthRedirectPayload {
  redirectUrl?: string
  errors?: Array<{ meta?: { redirectUrl?: string } }>
}

export interface OpenurpAuthOptions {
  appBasePath: string | (() => string)
  casAuthLoginUrl: string | (() => string)
  casLoginUrl: string | (() => string)
  casLogoutUrl: string | (() => string)
  tokenKey?: string
  userInfoKey?: string
  clearLocalStorageOnLogout?: boolean
  sidName?: string
  logoutUrl?: string | (() => string)
  fetcher?: typeof fetch
}

export interface OpenurpSessionService<TUser extends OpenurpCurrentUser = OpenurpCurrentUser> {
  setToken(token: string): void
  getToken(): string | null
  setUserInfo(userInfo: TUser): void
  getUserInfo(): TUser | null
  clearAuth(): void
  getAuthHeaders(contentType?: string): Record<string, string>
  login(redirectUrl?: string): void
  requireLogin(redirectUrl?: string): void
  logout(): Promise<void>
  getUserInfoBySid(sid: string): Promise<TUser | null>
  fetchCasUser(params?: Record<string, string>): Promise<TUser | null>
}

export interface OpenurpAuth<TUser extends OpenurpCurrentUser = OpenurpCurrentUser> {
  currentUser: Ref<TUser | null>
  authReady: Ref<boolean>
  sessionService: OpenurpSessionService<TUser>
  initializeAuth(): Promise<TUser | null>
  useAuth(): {
    currentUser: Ref<TUser | null>
    authReady: Ref<boolean>
    handleLogin: () => void
    handleLogout: () => Promise<void>
  }
}

const defaultTokenKey = 'beangle.ems.auth_token'
const defaultUserInfoKey = 'beangle.ems.user_info'
const defaultSidName = 'URP_SID'

export function createOpenurpAuth<TUser extends OpenurpCurrentUser = OpenurpCurrentUser>(options: OpenurpAuthOptions): OpenurpAuth<TUser> {
  const fetcher = options.fetcher ?? ((input, init) => globalThis.fetch(input, init))
  const sidName = options.sidName || defaultSidName

  const normalizePath = (path: string): string => {
    if (!path) return '/'
    const prefixed = path.startsWith('/') ? path : `/${path}`
    return prefixed.endsWith('/') ? prefixed : `${prefixed}/`
  }

  const getServiceUrl = (): string => `${window.location.origin}${normalizePath(readValue(options.appBasePath))}`

  const appendServiceParams = (url: string): string => {
    const nextUrl = new URL(url, window.location.origin)
    nextUrl.searchParams.set('service', getServiceUrl())
    nextUrl.searchParams.set('sid_name', sidName)
    return nextUrl.toString()
  }

  const sessionService: OpenurpSessionService<TUser> = {
    setToken(token: string): void {
      localStorage.setItem(options.tokenKey || defaultTokenKey, token)
    },

    getToken(): string | null {
      return localStorage.getItem(options.tokenKey || defaultTokenKey)
    },

    setUserInfo(userInfo: TUser): void {
      localStorage.setItem(options.userInfoKey || defaultUserInfoKey, JSON.stringify(userInfo))
    },

    getUserInfo(): TUser | null {
      const userInfo = localStorage.getItem(options.userInfoKey || defaultUserInfoKey)
      return userInfo ? JSON.parse(userInfo) as TUser : null
    },

    clearAuth(): void {
      if (options.clearLocalStorageOnLogout) {
        localStorage.clear()
        return
      }
      localStorage.removeItem(options.tokenKey || defaultTokenKey)
      localStorage.removeItem(options.userInfoKey || defaultUserInfoKey)
    },

    getAuthHeaders(contentType = 'application/vnd.api+json'): Record<string, string> {
      const token = this.getToken()
      const headers: Record<string, string> = {
        Accept: 'application/vnd.api+json',
      }
      if (contentType) headers['Content-Type'] = contentType
      if (token) headers.Authorization = `Bearer ${token}`
      return headers
    },

    login(redirectUrl?: string): void {
      window.location.href = appendServiceParams(redirectUrl || readValue(options.casLoginUrl))
    },

    requireLogin(redirectUrl?: string): void {
      this.clearAuth()
      this.login(redirectUrl)
    },

    async logout(): Promise<void> {
      try {
        const logoutUrl = options.logoutUrl ? readValue(options.logoutUrl) : ''
        if (logoutUrl) {
          const token = this.getToken()
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          if (token) headers.Authorization = `Bearer ${token}`

          await fetcher(logoutUrl, {
            method: 'POST',
            credentials: 'include',
            headers,
            cache: 'no-store',
          })
        }
      } catch {
        // Ignore logout transport errors and continue local cleanup.
      } finally {
        this.clearAuth()
        const serviceUrl = encodeURIComponent(getServiceUrl())
        window.location.href = `${readValue(options.casLogoutUrl)}?service=${serviceUrl}`
      }
    },

    async getUserInfoBySid(sid: string): Promise<TUser | null> {
      return this.fetchCasUser({ [sidName]: sid })
    },

    async fetchCasUser(params: Record<string, string> = {}): Promise<TUser | null> {
      try {
        const query = new URLSearchParams(params)
        const token = this.getToken()
        const loginUrl = readValue(options.casAuthLoginUrl)
        if (token && isCrossOriginUrl(loginUrl) && !query.has(sidName)) query.set(sidName, token)
        const queryString = query.toString()

        const response = await fetcher(`${loginUrl}${queryString ? `?${queryString}` : ''}`, {
          method: 'GET',
          credentials: 'include',
          redirect: 'manual',
          headers: { Accept: 'application/vnd.api+json' },
          cache: 'no-store',
        })

        if (response.status === 0 || response.status === 302 || response.status === 401) {
          this.requireLogin()
          return null
        }

        if (!response.ok) return this.getUserInfo()

        const data = (await response.json()) as CasUserResponse<TUser>
        if ((data.authenticated || data.success) && data.user) {
          if (data.token) this.setToken(data.token)
          this.setUserInfo(data.user)
          return data.user
        }

        this.requireLogin()
        return null
      } catch {
        return this.getUserInfo()
      }
    },
  }
  setOpenurpUrpSid(() => sessionService.getToken())

  const currentUser = ref<TUser | null>(sessionService.getUserInfo()) as Ref<TUser | null>
  const authReady = ref(false)
  let authInitPromise: Promise<TUser | null> | null = null

  const clearLoginQuery = () => {
    window.history.replaceState(null, '', `${window.location.origin}${window.location.pathname}${window.location.hash}`)
  }

  async function doInitializeAuth(): Promise<TUser | null> {
    const urlParams = new URLSearchParams(window.location.search)
    const urpSid = urlParams.get(sidName)
    const token = urlParams.get('token')
    const userName = urlParams.get('name')
    const userCode = urlParams.get('code')

    if (urpSid) {
      currentUser.value = await sessionService.getUserInfoBySid(urpSid)
      clearLoginQuery()
      return currentUser.value
    }

    if (token && userName && userCode) {
      sessionService.setToken(token)
      currentUser.value = { name: userName, code: userCode } as TUser
      sessionService.setUserInfo(currentUser.value)
      clearLoginQuery()
      return currentUser.value
    }

    currentUser.value = await sessionService.fetchCasUser()
    return currentUser.value
  }

  async function initializeAuth(): Promise<TUser | null> {
    if (authReady.value) return currentUser.value
    if (!authInitPromise) {
      authInitPromise = doInitializeAuth().finally(() => {
        authReady.value = true
      })
    }
    return authInitPromise
  }

  function useAuth() {
    const initAuth = async () => {
      await initializeAuth()
      authReady.value = true
    }

    const handleLogin = () => {
      sessionService.login()
    }

    const handleLogout = async () => {
      await sessionService.logout()
    }

    onMounted(() => {
      if (!authReady.value) initAuth()
    })

    return {
      currentUser,
      authReady,
      handleLogin,
      handleLogout,
    }
  }

  return {
    currentUser,
    authReady,
    sessionService,
    initializeAuth,
    useAuth,
  }
}

export function resolveAuthRedirectUrl(payload: AuthRedirectPayload, response: Response): string | undefined {
  return payload.redirectUrl || payload.errors?.find((error) => error.meta?.redirectUrl)?.meta?.redirectUrl || response.headers.get('Location') || undefined
}

function readValue(value: string | (() => string)): string {
  return typeof value === 'function' ? value() : value
}

function isCrossOriginUrl(url: string): boolean {
  if (typeof window === 'undefined') return false
  return new URL(url, window.location.origin).origin !== window.location.origin
}
