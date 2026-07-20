/**
 * 分镜配音视频生成（对接大模型/配音服务时在此替换为真实请求）
 */
export interface StoryboardDubbingGenerateParams {
  dialogue: string
  voiceName: string
  emotion: string
  lipSync: boolean
  /** 当前分镜原视频地址，作为对口型/混音的输入 */
  sourceVideoUrl: string
}

function resolveDubbingMockDelayMs(): number {
  try {
    const cfg = useRuntimeConfig()
    if (cfg?.public?.mockStep4PlusGen === false) {
      return 8000 + Math.floor(Math.random() * 4200)
    }
    if (cfg?.public?.mockStep4PlusGen === true) {
      return 900 + Math.floor(Math.random() * 500)
    }
  } catch {
    /* 非 Nuxt 上下文 */
  }
  const env = (import.meta as unknown as { env?: Record<string, string> }).env?.NUXT_PUBLIC_MOCK_STEP4_PLUS_GEN
  if (env === '0' || env === 'false') {
    return 8000 + Math.floor(Math.random() * 4200)
  }
  return import.meta.dev ? 900 + Math.floor(Math.random() * 500) : 8000 + Math.floor(Math.random() * 4200)
}

export async function requestStoryboardDubbingGenerate(
  params: StoryboardDubbingGenerateParams
): Promise<{ videoUrl: string }> {
  // 未接真实接口前：由 NUXT_PUBLIC_MOCK_STEP4_PLUS_GEN / runtimeConfig.public.mockStep4PlusGen 控制短/长延迟
  await new Promise((r) => setTimeout(r, resolveDubbingMockDelayMs()))
  // 正式对接后改为：return await $fetch('/api/...', { method: 'POST', body: params })
  return {
    videoUrl: params.sourceVideoUrl
  }
}
