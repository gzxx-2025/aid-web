/**
 * 同源图片代理：供前端 Canvas 切图等场景拉取 OSS/CDN 图片，避免跨域污染 canvas。
 */
export default defineEventHandler(async (event) => {
  const rawUrl = String(getQuery(event).url || '').trim()
  if (!rawUrl) {
    throw createError({ statusCode: 400, statusMessage: '缺少 url 参数' })
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'url 格式无效' })
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: '仅支持 http/https' })
  }

  if (rawUrl.length > 2048) {
    throw createError({ statusCode: 400, statusMessage: 'url 过长' })
  }

  let upstream: Response
  try {
    upstream = await fetch(rawUrl, {
      headers: { Accept: 'image/*,*/*;q=0.8' },
      redirect: 'follow'
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: '图片拉取失败' })
  }

  if (!upstream.ok) {
    throw createError({
      statusCode: upstream.status >= 400 ? upstream.status : 502,
      statusMessage: '图片拉取失败'
    })
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
  if (!contentType.startsWith('image/')) {
    throw createError({ statusCode: 400, statusMessage: '非图片资源' })
  }

  const buffer = Buffer.from(await upstream.arrayBuffer())
  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Cache-Control', 'private, max-age=300')
  return buffer
})
