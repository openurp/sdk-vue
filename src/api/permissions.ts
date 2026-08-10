import { computed, ref, type Ref } from 'vue'

/**
 * 前端权限集成（通用）。
 *
 * 后端权限接口（如 `GET /api/edu/learning/permissions.json`）支持两种返回结构：
 *
 * 扁平资源数组（推荐）：
 *
 * ```json
 * ["/progresses", "/alternatives", "/course-type-changes", "/courses", "/grades", "/programs", "/exams"]
 * ```
 *
 * 或与项目 `permissions.json` 相同的路由结构：
 *
 * ```json
 * [{ "route": "/exams", "resources": ["exams", "..."] }]
 * ```
 *
 * - `route` 是前端路由（如 `/courses`、`/exams`），不在列表里的路由不显示对应菜单/入口。
 * - `resources` 是该路由下可访问的 API 资源；匹配时统一去掉 `resourcePrefix`
 *   （如 `/api/edu/learning`）前缀，因此两端都可以不带该前缀声明。
 * - 扁平数组中的每一项都是已授权的 API 资源；资源名与前端路由同名时（如 `alternatives`），
 *   前端视为对应路由可访问（`canRoute`/`can` 均生效），无需后端为子功能页单独下发 route。
 *
 * 容错策略：权限接口尚未部署或请求失败时 fail-open（不隐藏任何功能），
 * 避免权限服务抖动导致整个前端不可用；后端始终是最终访问控制方。
 */

export interface OpenurpRoutePermission {
  route: string
  resources?: string[]
}

/** 扁平资源数组中的一项：已授权的 API 资源（相对 `resourcePrefix`，如 `/alternatives`）。 */
export type OpenurpPermissionResource = string

export interface OpenurpPermissionsOptions {
  /** 权限接口路径（相对 API 根的路径，如 `/api/edu/learning/permissions.json`）。 */
  permissionsPath: string
  /**
   * API 资源前缀（如 `/api/edu/learning`）。
   * `resources` 与前端声明的资源 key 匹配前统一去掉该前缀。
   */
  resourcePrefix?: string
  /** 路由别名/子路由归一到权限声明的路由。 */
  routeAliases?: Array<[string | RegExp, string]>
  /** 直接放行（mock/调试模式），默认 false。 */
  grantAll?: boolean | (() => boolean)
  /** 由应用提供：把相对路径拼成完整请求 URL（可带 token/URP_SID）。 */
  getApiUrl?: (path: string, token?: string | null) => string
  /** 判断 URL 是否跨域，跨域时不携带应用鉴权头。 */
  isCrossOriginUrl?: (url: string) => boolean
  getToken?: () => string | null
  getAuthHeaders?: () => Record<string, string>
  /** 401 时触发登录跳转。 */
  requireLogin?: (redirectUrl?: string) => void
  fetcher?: typeof fetch
  warn?: (message: string, error: unknown) => void
}

export interface OpenurpPermissions {
  /**
   * 当前用户是否拥有该路由（菜单、入口、路由守卫都基于它）。
   * 权限声明的 route 或任一 route 下授权的资源名（资源即路由）命中时均视为可访问。
   */
  canRoute(path: string): boolean
  /** 当前用户在该路由下是否可访问指定 API 资源（按钮、链接基于它）。 */
  can(route: string, resource: string): boolean
  /** 拉取权限数据；幂等，失败时 fail-open。 */
  initialize(): Promise<void>
  /** 供路由守卫使用：确保权限已加载完成。 */
  ensureLoaded(): Promise<void>
  /** 是否已尝试加载（成功或失败）。 */
  readonly loaded: Ref<boolean>
}

/**
 * 创建前端权限服务。
 *
 * 资源匹配对两端写法都比较宽容：后端可以给完整 URL、带 `{studentId}` 占位符的路径、
 * 相对 `resourcePrefix` 的路径或资源短名，前端声明的 key 只要与最后一段或后缀一致即可。
 */
export function createOpenurpPermissions(options: OpenurpPermissionsOptions): OpenurpPermissions {
  const fetcher = options.fetcher ?? ((input, init) => globalThis.fetch(input, init))
  const rawPermissions = ref<OpenurpRoutePermission[]>([])
  const rawResourceList = ref<OpenurpPermissionResource[]>([])
  const loaded = ref(false)
  const failed = ref(false)

  const isGrantAll = (): boolean =>
    typeof options.grantAll === 'function' ? options.grantAll() : !!options.grantAll

  /** 后端未给数据或加载失败时，前端全部放行（仅用于显示，非安全边界）。 */
  const grantAll = computed(() => isGrantAll() || failed.value || !loaded.value)

  const routeAliases: Array<[RegExp, string]> = (options.routeAliases || []).map(
    ([pattern, target]) => [typeof pattern === 'string' ? new RegExp(pattern) : pattern, target],
  )

  /** 规范化路由：去掉 query/hash、尾部斜杠，别名归一到权限路由。 */
  const routeKey = (path: string): string => {
    let clean = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
    if (!clean.startsWith('/')) clean = `/${clean}`
    for (const [pattern, key] of routeAliases) {
      if (pattern.test(clean)) return key
    }
    return clean
  }

  /** 规范化资源：去掉来源、`resourcePrefix` 前缀、query/hash 和首尾斜杠。 */
  const normalizeResource = (value: string): string => {
    const path = value.trim().split(/[?#]/)[0].replace(/^https?:\/\/[^/]+/i, '')
    const prefix = (options.resourcePrefix || '').trim().replace(/^\/+/, '')
    const stripped = path.replace(/^\/+/, '')
    const base = prefix && stripped.startsWith(prefix) ? stripped.slice(prefix.length) : stripped
    return base.replace(/^\/+/, '').replace(/\/+$/, '')
  }

  /** 路由 → 资源集合：含权限声明的 route，以及“资源即路由”推导出的子路由。 */
  const byRoute = computed(() => {
    const map = new Map<string, Set<string>>()
    for (const item of rawPermissions.value) {
      const route = routeKey(item.route || '')
      if (!route) continue
      const resources = new Set((item.resources || []).map(normalizeResource).filter(Boolean))
      map.set(route, resources)
      // 资源即路由：授权了某功能资源（如 alternatives），该资源对应的前端路由同样可达，
      // 且该资源本身授权其页面按钮（can(route, resource)）。
      for (const resource of resources) {
        const resourceRoute = routeKey(resource)
        if (!resourceRoute || resourceRoute === route) continue
        const set = map.get(resourceRoute) ?? new Set<string>()
        set.add(resource)
        map.set(resourceRoute, set)
      }
    }
    // 扁平资源数组：每个已授权资源即一条路由，资源本身授权其页面按钮。
    for (const resource of rawResourceList.value) {
      const key = normalizeResource(resource)
      if (!key) continue
      const resourceRoute = routeKey(key)
      const set = map.get(resourceRoute) ?? new Set<string>()
      set.add(key)
      map.set(resourceRoute, set)
    }
    return map
  })

  /** 扁平资源数组的全局授权资源集合。 */
  const grantedResources = computed(() => {
    const set = new Set<string>()
    for (const resource of rawResourceList.value) {
      const key = normalizeResource(resource)
      if (key) set.add(key)
    }
    return set
  })

  const canRoute = (path: string): boolean => {
    if (grantAll.value) return true
    return byRoute.value.has(routeKey(path))
  }

  const can = (route: string, resource: string): boolean => {
    if (grantAll.value) return true
    const key = normalizeResource(resource)
    if (!key) return false
    // 扁平资源数组：资源为全局授权，命中即视为可用（如 /exams 页面的缓考按钮依赖 exam-defers 资源）。
    if (rawResourceList.value.length > 0 && grantedResources.value.has(key)) return true
    const resources = byRoute.value.get(routeKey(route))
    if (!resources) return false
    for (const item of resources) {
      if (item === key || item.endsWith(`/${key}`)) return true
      const lastSegment = key.split('/').pop() as string
      if (item === lastSegment || item.endsWith(`/${lastSegment}`)) return true
    }
    return false
  }

  const initialize = async (): Promise<void> => {
    if (loaded.value) return
    if (isGrantAll()) {
      loaded.value = true
      return
    }
    try {
      const url = options.getApiUrl
        ? options.getApiUrl(options.permissionsPath, options.getToken?.() ?? null)
        : options.permissionsPath
      const headers = options.isCrossOriginUrl?.(url)
        ? { Accept: 'application/json' }
        : (options.getAuthHeaders?.() ?? {})
      const response = await fetcher(url, {
        method: 'GET',
        credentials: 'include',
        headers,
        cache: 'no-store',
      })
      if (response.status === 401) options.requireLogin?.()
      if (!response.ok) throw new Error(`permissions (${response.status})`)
      const data = (await response.json()) as unknown
      if (Array.isArray(data) && typeof data[0] === 'string') {
        rawResourceList.value = data as OpenurpPermissionResource[]
        rawPermissions.value = []
      } else {
        rawPermissions.value = Array.isArray(data) ? (data as OpenurpRoutePermission[]) : []
        rawResourceList.value = []
      }
    } catch (error) {
      ;(options.warn ?? ((message, e) => console.warn(message, e)))(
        '[permissions] 权限接口加载失败，前台暂不隐藏功能',
        error,
      )
      failed.value = true
    } finally {
      loaded.value = true
    }
  }

  const ensureLoaded = async (): Promise<void> => {
    if (!loaded.value) await initialize()
  }

  return { canRoute, can, initialize, ensureLoaded, loaded }
}
