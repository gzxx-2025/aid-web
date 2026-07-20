/**
 * 应用启动时拉取 /auth/public-config，同步 crypto.enabled 与 RSA 公钥（与登录页缓存共用）。
 */
import { authPublicConfig } from '~/utils/businessApi'
import { applyApiCryptoFromPublicConfig, hydrateApiCryptoFromSessionCache } from '~/utils/apiCrypto'

export default defineNuxtPlugin(() => {
  hydrateApiCryptoFromSessionCache()
  void authPublicConfig()
    .then((data) => {
      applyApiCryptoFromPublicConfig(data.crypto, data.serverTime)
      try {
        sessionStorage.setItem('auth:public-config:v1', JSON.stringify(data))
      } catch {
        /* ignore */
      }
    })
    .catch(() => {
      /* 保留 session 缓存或默认明文 */
    })
})
