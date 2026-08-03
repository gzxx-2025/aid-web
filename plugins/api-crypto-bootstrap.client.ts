/**
 * 应用启动时拉取 /auth/public-config，同步 crypto、品牌与 SEO 缓存（与登录页共用）。
 */
import { setAuthPublicConfigData } from '~/composables/useAuthPublicConfig'
import { authPublicConfig } from '~/utils/businessApi'
import { hydrateApiCryptoFromSessionCache } from '~/utils/apiCrypto'

export default defineNuxtPlugin(() => {
  hydrateApiCryptoFromSessionCache()
  void authPublicConfig()
    .then((data) => {
      setAuthPublicConfigData(data)
    })
    .catch(() => {
      /* 保留 session 缓存或默认明文 */
    })
})
