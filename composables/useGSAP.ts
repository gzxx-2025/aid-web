import { gsap } from 'gsap'

const pluginMap = {
  ScrollTrigger: () => import('gsap/ScrollTrigger'),
  Flip: () => import('gsap/Flip'),
  ScrollToPlugin: () => import('gsap/ScrollToPlugin'),
  TextPlugin: () => import('gsap/TextPlugin')
} as const

type PluginName = keyof typeof pluginMap

/**
 * GSAP 入口：SSR 安全使用方式见 useMotion；插件按需懒加载。
 */
export function useGSAP() {
  async function lazyLoadPlugin(name: PluginName) {
    const mod = (await pluginMap[name]()) as Record<string, unknown>
    const plugin = mod[name]
    if (plugin) {
      gsap.registerPlugin(plugin as object)
    }
    return plugin
  }

  return {
    gsap,
    lazyLoadPlugin
  }
}
