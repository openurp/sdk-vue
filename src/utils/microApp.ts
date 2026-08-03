export interface WujieAppLifecycles {
  mount: () => void | Promise<void>
  unmount: () => void
}

declare global {
  interface Window {
    __POWERED_BY_WUJIE__?: boolean
    __WUJIE?: { mount?: () => void }
    __WUJIE_PUBLIC_PATH__?: string
    __WUJIE_MOUNT?: () => void | Promise<void>
    __WUJIE_UNMOUNT?: () => void
  }
}

/** Returns true inside Wujie, or when `?micro=1` is used for local shell testing. */
export function isWujieMicroApp(): boolean {
  if (typeof window === 'undefined') return false
  if (window.__POWERED_BY_WUJIE__) return true
  if (window.__WUJIE) return true
  if (window.__WUJIE_PUBLIC_PATH__) return true
  if ((window as unknown as { $wujie?: unknown }).$wujie) return true
  return new URLSearchParams(window.location.search).get('micro') === '1'
}

/** Registers Wujie lifecycle hooks and mounts immediately when running standalone. */
export function registerWujieApp(lifecycles: WujieAppLifecycles): void {
  if (typeof window === 'undefined') return
  if (isWujieMicroApp()) {
    window.__WUJIE_MOUNT = lifecycles.mount
    window.__WUJIE_UNMOUNT = lifecycles.unmount
  } else {
    void lifecycles.mount()
  }
}
