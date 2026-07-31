import { defineAsyncComponent, type Component } from 'vue'

type AsyncComponentModule = Component | { default: Component }

/**
 * Keeps eager preloading and Vue's first render on the same import promise.
 * A rejected import is cleared so a transient network failure can be retried.
 */
export function createPreloadableAsyncComponent(
  importer: () => Promise<AsyncComponentModule>,
  loadingComponent: Component
) {
  let loadPromise: Promise<AsyncComponentModule> | null = null

  const load = () => {
    if (!loadPromise) {
      loadPromise = importer().catch((error) => {
        loadPromise = null
        throw error
      })
    }
    return loadPromise
  }

  return {
    component: defineAsyncComponent({
      loader: load,
      loadingComponent,
      delay: 0,
      suspensible: false
    }),
    preload: () => load().then(() => undefined)
  }
}

/** Start fetching after the initial paint, or within timeoutMs on a busy page. */
export function preloadComponentWhenIdle(
  preload: () => Promise<void>,
  timeoutMs = 800
): () => void {
  if (!import.meta.client) return () => undefined

  let cancelled = false

  const run = () => {
    if (cancelled) return
    void preload().catch(() => {
      // The async component will retry and surface Vue's normal error if opened.
    })
  }

  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(run, { timeout: timeoutMs })
    return () => {
      cancelled = true
      window.cancelIdleCallback(handle)
    }
  }

  const handle = window.setTimeout(run, Math.min(timeoutMs, 200))
  return () => {
    cancelled = true
    window.clearTimeout(handle)
  }
}
