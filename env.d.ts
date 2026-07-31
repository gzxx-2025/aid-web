/// <reference path="./.nuxt/nuxt.d.ts" />

/**
 * Nuxt 编译期注入的 import.meta 标志。
 * 根 tsconfig 排除了 .nuxt，且 `/// <reference types="nuxt" />` 未带上 app augments，
 * 在此显式补齐，避免「ImportMeta 上不存在属性 client」报错。
 */
interface ImportMeta {
  readonly browser: boolean
  readonly client: boolean
  readonly dev: boolean
  readonly server: boolean
  readonly test: boolean
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.jpeg' {
  const src: string
  export default src
}

declare module '*.webp' {
  const src: string
  export default src
}

declare module 'qrcode' {
  export interface QRCodeToDataURLOptions {
    width?: number
    margin?: number
    color?: { dark?: string; light?: string }
  }
  function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>
  const QRCode: { toDataURL: typeof toDataURL }
  export default QRCode
}
