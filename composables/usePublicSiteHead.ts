import { useAuthPublicConfig } from '~/composables/useAuthPublicConfig'

const DEFAULT_TITLE = 'AI·D'
const DEFAULT_DESCRIPTION = '专业的漫画动漫视频创作平台，提供从剧本到成片的全流程创作工具'
const DEFAULT_FAVICON = '/favicon.svg'

/**
 * 根据 POST /auth/public-config 的 basic（SEO）与 brand（Favicon）动态写入文档 head。
 * 配置缺失时回退到 nuxt.config 默认值。
 */
export function usePublicSiteHead() {
  const { siteName, siteDescription, siteKeywords, faviconUrl, loadPublicConfig } =
    useAuthPublicConfig()

  useHead(() => {
    const title = siteName.value || DEFAULT_TITLE
    const description = siteDescription.value || DEFAULT_DESCRIPTION
    const keywords = siteKeywords.value
    const iconHref = faviconUrl.value || DEFAULT_FAVICON
    const isSvgIcon = /\.svg(?:$|\?)/i.test(iconHref)

    return {
      title,
      meta: [
        { name: 'description', content: description },
        ...(keywords ? [{ name: 'keywords', content: keywords }] : []),
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description }
      ],
      link: [
        {
          key: 'brand-favicon',
          rel: 'icon',
          ...(isSvgIcon ? { type: 'image/svg+xml' } : {}),
          href: iconHref
        },
        {
          key: 'brand-apple-touch-icon',
          rel: 'apple-touch-icon',
          href: iconHref
        }
      ]
    }
  })

  if (import.meta.client) {
    void loadPublicConfig()
  }
}
