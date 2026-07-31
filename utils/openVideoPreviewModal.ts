import { h } from 'vue'
import { Modal } from 'ant-design-vue'

export interface OpenVideoPreviewModalOptions {
  url: string
  title?: string
  width?: string | number
}

/** 与图片预览弹窗同全屏壳层；右上角关闭，视频等比适配且高度不超出 */
export function openVideoPreviewModal(options: OpenVideoPreviewModalOptions) {
  const url = String(options.url || '').trim()
  if (!url) return
  const title = options.title?.trim() || '预览'
  Modal.info({
    icon: null,
    width: options.width ?? '100%',
    centered: false,
    closable: true,
    maskClosable: true,
    footer: null,
    style: { top: 0, paddingBottom: 0, margin: 0 },
    wrapClassName: 'video-preview-modal-wrap',
    content: h('div', { class: 'video-preview-modal-shell' }, [
      h('div', { class: 'video-preview-modal-header' }, [
        h('div', { class: 'video-preview-modal-header__title', title }, title),
        h('div', { class: 'video-preview-modal-header__trail', 'aria-hidden': 'true' })
      ]),
      h('div', { class: 'video-preview-modal-stage' }, [
        h('video', {
          class: 'video-preview-modal__video',
          src: url,
          controls: true,
          playsinline: true,
          preload: 'metadata',
          controlsList: 'nodownload'
        })
      ])
    ])
  })
}
