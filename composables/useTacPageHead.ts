import { getTacCssUrl, getTacJsUrl } from '~/utils/tacAssets'

/**
 * 登录页显式引入 `static/tac` → 站点 `/tac/css/tac.css`、`/tac/js/tac.min.js`
 *（勿用 `/_nuxt/tac/...`，那是 Vite 构建目录，不是静态资源目录）
 */
export function useTacPageHead() {
  useHead(() => {
    const tacCssUrl = getTacCssUrl()
    const tacJsUrl = getTacJsUrl()
    return {
      link: [
        {
          key: 'tac-css',
          rel: 'stylesheet',
          href: tacCssUrl
        }
      ],
      script: [
        {
          key: 'tac-js',
          src: tacJsUrl,
          defer: true,
          tagPosition: 'bodyClose'
        }
      ]
    }
  })

  return {
    tacCssUrl: getTacCssUrl(),
    tacJsUrl: getTacJsUrl()
  }
}
