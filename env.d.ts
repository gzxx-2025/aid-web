/// <reference path="./.nuxt/nuxt.d.ts" />

declare module '*.svg' {
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
