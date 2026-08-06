import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import viteCompression from 'vite-plugin-compression'

const env =
  (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ??
  {}
/** 开发代理目标；请在 `.env` / `.env.development` 中配置 `NUXT_PROXY_TARGET` */
const proxyTarget = env.NUXT_PROXY_TARGET || 'http://127.0.0.1:8080'

const isProd = env.NODE_ENV === 'production'
/**
 * 构建期 Gzip 预压缩（vite-plugin-compression + nitro.compressPublicAssets）。
 * 默认关闭；需要时再开：NUXT_BUILD_GZIP=1 npm run generate
 */
const enableBuildGzip = env.NUXT_BUILD_GZIP === '1' || env.NUXT_BUILD_GZIP === 'true'
/** 生产构建移除调试类 console，保留 console.error */
const prodPureConsole = [
  'console.log',
  'console.info',
  'console.debug',
  'console.warn',
  'console.trace',
  'console.table',
  'console.group',
  'console.groupCollapsed',
  'console.groupEnd',
  'console.dir',
  'console.dirxml',
  'console.time',
  'console.timeEnd',
  'console.count',
  'console.assert'
]

/**
 * 仅拆「偏异步/重型」依赖。勿把 vue / pinia / vue-router / ant-design-vue 强行拆开，
 * 否则生产易出现循环依赖 TDZ：Cannot access 'X' before initialization。
 */
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined
  if (id.includes('gsap')) return 'vendor-gsap'
  if (id.includes('three')) return 'vendor-three'
  if (id.includes('@webav')) return 'vendor-webav'
  if (id.includes('quill')) return 'vendor-quill'
  return undefined
}

export default defineNuxtConfig({
  compatibilityDate: '2026-8-01',
  /** 开发环境监听所有网卡，局域网可通过本机 IP 访问（如 http://192.168.x.x:3000） */
  devServer: {
    host: '0.0.0.0',
    port: 3000
  },
  devtools: { enabled: !isProd },
  /**
   * 生产关闭 sourcemap，避免 `.map` / 源映射把本机绝对路径（如 `E:\前端代码文件\...`）
   * 打进可被下载的静态产物。开发态仍可用默认调试能力。
   */
  sourcemap: {
    client: !isProd,
    server: !isProd
  },
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
    '~/assets/css/home-new-page.css',
    '~/assets/css/home-new-compact-viewport.css',
    '~/assets/css/create-flow-compact-viewport.css',
    '~/assets/css/compact-viewport-btn-radius.css',
    '~/assets/css/create-steps-ant-overrides.css',
    '~/assets/css/app-confirm-modal.css',
    '~/assets/css/viewport-compact-scale-overrides.css',
    '~/assets/css/viewport-large-scale-overrides.css',
    '~/assets/css/viewport-wide-range.css',
    '~/assets/css/storyboard-step-shared.css',
    '~/assets/css/scp-step-shared.css',
    '~/assets/css/shimmer-image.css',
    '~/assets/css/video-play-btn.css',
    '~/assets/css/asset-card-cancel-hint.css',
    '~/assets/css/empty-image-icon.css',
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
          href: '/favicon.svg'
        },
        {
          rel: 'apple-touch-icon',
          href: '/favicon.svg'
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
    mediaProxyAllowedHosts: env.NUXT_MEDIA_PROXY_ALLOWED_HOSTS || '',
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
      // 开发: nuxt dev 加载 .env.development；生产构建: 加载 .env.production
      '/url/**': {
        proxy: `${proxyTarget.replace(/\/$/, '')}/**`
      }
    },
    output: {
      dir: 'dist'
    },
    /** 需显式 NUXT_BUILD_GZIP=1 才开启；与 vite-plugin-compression 互补 */
    compressPublicAssets: isProd && enableBuildGzip
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
          // 根字号档位保持 px；侧栏与 compact 相关文件自行控制 rem 换算
          if (/root-font-size\.css$/i.test(file)) return true
          if (/create-flow-compact-viewport\.css$/i.test(file)) return true
          if (/compact-viewport-btn-radius\.css$/i.test(file)) return true
          return false
        }
      }
    }
  },
  /**
   * 注意：Nuxt 3.21 / Vite 7 下不可再设 `build.cssCodeSplit: false`。
   * 该选项会把样式打进 `_nuxt/style.*.css`，但入口 HTML/JS 不引用该文件，
   * 导致 CreateFlowShell 等 SFC scoped 样式在 `nuxt generate` 后整页丢失
   *（本地 dev 正常，流程页刷新也不恢复）。恢复默认按 chunk 拆分并由 JS 导入。
   */
  vite: {
    esbuild: {
      drop: isProd ? ['debugger'] : [],
      pure: isProd ? prodPureConsole : []
    },
    server: {
      hmr: true,
      // 避免 generate/build 输出的 dist 被 Vite 监听到后疯狂 page reload，进而清掉 .nuxt/dist
      watch: {
        ignored: ['**/dist/**', '**/dist.zip']
      },
      /**
       * 开发态预热创作流程入口，减轻「首次点步骤 → 上百个 ESM pending → 页面假死」。
       * 仅影响 npm run dev，不影响 generate/线上包。
       */
      warmup: {
        clientFiles: [
          './layouts/create.vue',
          './components/create/CreateFlowShell.vue',
          './pages/create/**/*.vue',
          './stores/creation.ts',
          './plugins/*.client.ts',
          './composables/useCreateFlow*.ts',
          './utils/createFlow*.ts',
          './utils/businessApi.ts'
        ]
      }
    },
    css: {
      preprocessorOptions: {
        css: {}
      }
    },
    /**
     * 开发态必须预构建重依赖。清空 include 会导致 ant-design-vue / pinia 等
     * 被拆成大量裸 ESM 请求（浏览器并发有限 → Network 里一堆 Pending → 点击无响应）。
     * 生产构建仍走 manualChunks / 按需组件，不受此处影响。
     */
    optimizeDeps: {
      include: [
        'ant-design-vue',
        'ant-design-vue/es',
        '@ant-design/icons-vue',
        'vue',
        'vue-router',
        'pinia',
        'pinia-plugin-persistedstate',
        'axios',
        'dayjs',
        'async-validator',
        '@ctrl/tinycolor',
        'scroll-into-view-if-needed',
        'compute-scroll-into-view',
        'pako',
        'qrcode',
        'vuedraggable',
        'sortablejs',
        'driver.js'
      ]
    },
    build: {
      /** 与顶层 `sourcemap` 对齐：生产不输出客户端 source map */
      sourcemap: !isProd,
      rollupOptions: {
        output: {
          manualChunks
        }
      },
      /** 老机器 generate：降低并行压缩峰值（可通过环境变量覆盖） */
      minify: 'esbuild',
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1500
    },
    plugins: [
      Components({
        dts: false,
        resolvers: [
          AntDesignVueResolver({
            importStyle: false,
            resolveIcons: false
          })
        ]
      }),
      ...(isProd && enableBuildGzip
        ? [
            viteCompression({
              algorithm: 'gzip',
              ext: '.gz',
              threshold: 10240,
              deleteOriginFile: false
            })
          ]
        : [])
    ]
  },
  // 将当前页相关样式内联进 HTML，首屏即有布局样式（Nuxt 3.13+ 用 features.inlineStyles）
  features: {
    inlineStyles: true
  }
})
