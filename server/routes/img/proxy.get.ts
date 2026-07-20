import { handleImageProxyRequest } from '../../utils/imageProxyCore'

/** 备用图片代理路径，避免正式环境 /api/** 被网关转发到 Java 后端 */
export default defineEventHandler((event) => handleImageProxyRequest(event))
