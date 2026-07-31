import type { Ref } from 'vue'
import { onUnmounted } from 'vue'
import { useGSAP } from '~/composables/useGSAP'

type MotionGsap = ReturnType<typeof useGSAP>['gsap']
type MotionCallback = (gsap: MotionGsap) => void

/**
 * 组件级 GSAP 生命周期：context 作用域 + 卸载清理。
 * 仅在 root 已挂载后调用 `run`。
 */
export function useMotion(rootRef: Ref<HTMLElement | null | undefined>) {
  const { gsap } = useGSAP()
  let ctx: ReturnType<MotionGsap['context']> | null = null

  function kill() {
    ctx?.revert()
    ctx = null
  }

  function run(callback: MotionCallback) {
    if (!import.meta.client) return
    kill()
    const root = rootRef.value
    if (!root) return
    ctx = gsap.context(() => {
      callback(gsap)
    }, root)
  }

  onUnmounted(() => {
    kill()
  })

  return {
    gsap,
    run,
    kill
  }
}
