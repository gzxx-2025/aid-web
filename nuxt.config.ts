const proxyTarget =
  (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.NUXT_PROXY_TARGET || 'http://101.37.232.202:8080'

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt', '@nuxt/eslint'],
  /** 项目静态资源目录为 `static/`（含 `static/tac` 行为验证码），映射为站点根路径 `/tac/**` */
  dir: {
    public: 'static'
  },
  typescript: {
    strict: false,
    typeCheck: false,
    shim: false
  },
  css: [
    '~/assets/css/root-font-size.css',
    '~/assets/css/main.css',
    '~/assets/css/home-theme.css',
    '~/assets/css/home-legacy-page.css',
    '~/assets/css/create-flow-compact-viewport.css',
    '~/assets/css/compact-viewport-btn-radius.css',
    '~/assets/css/create-steps-ant-overrides.css',
    '~/assets/css/app-confirm-modal.css',
    '~/assets/css/viewport-compact-scale-overrides.css',
    '~/assets/css/storyboard-step-shared.css',
    '~/assets/css/scp-step-shared.css',
    // 玻璃态动效增强层：不需要时注释掉下一行即可，无需改组件
    // '~/assets/css/glass-effects.css'
  ],
  app: {
    head: {
      title: 'AI·D',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: '专业的漫画动漫视频创作平台，提供从剧本到成片的全流程创作工具'
        }
      ],
      link: [
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🎨</text></svg>'
        }
      ]
    },
    // 关闭全页过渡，减轻首屏刷新与样式加载叠加时的闪烁（需路由动画可改为仅客户端路由启用）
    pageTransition: false,
    baseURL: '/'
  },
  pinia: {
    storesDirs: ['./stores/**']
  },
  runtimeConfig: {
    public: {
      // 图形验证码地址（可在 .env 里通过 NUXT_PUBLIC_CAPTCHA_PATH 覆盖）
      captchaPath: '/api/auth/captchaImage',
      /**
       * 分镜脚本 / 分镜视频 / 配音等第四步及之后：默认走真实接口。
       * 本地联调需模拟进度时可设 NUXT_PUBLIC_MOCK_STEP4_PLUS_GEN=1
       */
      mockStep4PlusGen: false,
      /**
       * 低分辨率（769px–1440px）视口紧凑缩放（根节点 zoom 0.75）。
       * 设为 false 或环境变量 NUXT_PUBLIC_VIEWPORT_COMPACT_SCALE=0 可全局关闭；
       * 用户仍可通过页面右下角开关在浏览器内单独控制（localStorage）。
       */
      viewportCompactScale: false
    }
  },
  nitro: {
    routeRules: {
      // 创作流程为登录后客户端应用，关闭 SSR 避免 Pinia payload 序列化异常
      '/create/**': { ssr: false },
      '/index-legacy': { redirect: '/' },
      // 开发: nuxt dev 加载 .env.development；生产构建: 加载 .env.production
      '/url/**': {
        proxy: `${proxyTarget.replace(/\/$/, '')}/**`
      }
    },
    output: {
      dir: 'dist'
    }
  },
  postcss: {
    plugins: {
      'postcss-pxtorem': {
        rootValue: 16,
        unitPrecision: 5,
        propList: ['*'],
        minPixelValue: 12,
        mediaQuery: true,
        exclude(file: string) {
          if (!file) return false
          if (/node_modules/i.test(file)) return true
          // 根字号档位保持 px
          if (/root-font-size\.css$/i.test(file)) return true
          if (/create-flow-compact-viewport\.css$/i.test(file)) return true
          if (/compact-viewport-btn-radius\.css$/i.test(file)) return true
          return false
        }
      }
    }
  },
  // 生产构建合并 CSS，减少首屏多个 link 竞态导致的 FOUC
  vite: {
    build: {
      cssCodeSplit: false
    },
    css: {
      preprocessorOptions: {
        css: {}
      }
    },
    optimizeDeps: {
      include: ['ant-design-vue']
    }
  },
  // 将当前页相关样式内联进 HTML，首屏即有布局样式（Nuxt 3.10+）
  experimental: {
    inlineSSRStyles: true
  }
})
