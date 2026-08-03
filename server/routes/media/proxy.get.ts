import { handleMediaProxyRequest } from '../../utils/mediaProxyCore'

/** Nuxt 自有流媒体代理，避免生产环境 /api/** 被业务后端网关接管。 */
export default defineEventHandler((event) => handleMediaProxyRequest(event))
