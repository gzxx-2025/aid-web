import { handleMediaProxyRequest } from '../utils/mediaProxyCore'

/** 兼容旧地址；新代码使用不受生产环境 API 网关影响的 /media/proxy。 */
export default defineEventHandler((event) => handleMediaProxyRequest(event))
