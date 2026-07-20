/**
 * 第四步及之后（分镜脚本 / 分镜视频 / 配音等）本地模拟开关。
 * 默认关闭；设 NUXT_PUBLIC_MOCK_STEP4_PLUS_GEN=1 可开启短延迟模拟。
 */
export function useStep4PlusMockGen(): { enabled: boolean } {
  if (import.meta.server) {
    return { enabled: false }
  }
  try {
    const cfg = useRuntimeConfig()
    const raw = cfg.public?.mockStep4PlusGen
    if (typeof raw === 'boolean') return { enabled: raw }
    if (raw === '0' || raw === 'false') return { enabled: false }
    if (raw === '1' || raw === 'true') return { enabled: true }
  } catch {
    /* useRuntimeConfig outside Nuxt setup */
  }
  const env = (import.meta as unknown as { env?: Record<string, string> }).env?.NUXT_PUBLIC_MOCK_STEP4_PLUS_GEN
  if (env === '0' || env === 'false') return { enabled: false }
  if (env === '1' || env === 'true') return { enabled: true }
  return { enabled: false }
}
