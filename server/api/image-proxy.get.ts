import { handleImageProxyRequest } from '../utils/imageProxyCore'

/** 兼容旧地址；与 /img/proxy 共用同一套 SSRF、重定向和体积限制。 */
export default defineEventHandler((event) => handleImageProxyRequest(event))
