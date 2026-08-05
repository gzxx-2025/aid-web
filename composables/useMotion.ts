import type { Ref } from 'vue'
import { onUnmounted } from 'vue'
import { loadGsap } from '~/composables/useGSAP'

type MotionGsap = typeof import('gsap').gsap
type MotionCallback = (gsap: MotionGsap) => void

/**
 * 组件级 GSAP 生命周期：context 作用域 + 卸载清理。
 * 仅在 root 已挂载后调用 `run`（内部异步加载 gsap）。
 */
export function useMotion(rootRef: Ref<HTMLElement | null | undefined>) {
  let ctx: { revert: () => void } | null = null
  let runToken = 0

  function kill() {
    ctx?.revert()
    ctx = null
  }

  async function run(callback: MotionCallback) {
    if (!import.meta.client) return
    const token = ++runToken
    kill()
    const root = rootRef.value
    if (!root) return
    const gsap = await loadGsap()
    if (token !== runToken || rootRef.value !== root) return
    ctx = gsap.context(() => {
      callback(gsap)
    }, root)
  }

  onUnmounted(() => {
    runToken += 1
    kill()
  })

  return {
    run,
    kill
  }
}
