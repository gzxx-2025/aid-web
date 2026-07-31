import { computed, defineComponent, h, ref, watch } from 'vue'
import { Modal } from 'ant-design-vue'
import { LeftOutlined, RightOutlined } from '@ant-design/icons-vue'
import ImagePreviewViewer from '~/components/common/ImagePreviewViewer.vue'

export interface ImageGalleryPreviewItem {
  url: string
  title?: string
}

/** 单张或多张参考图预览；多张时支持左右切换；右上角关闭 */
export function openImageGalleryPreviewModal(
  images: ImageGalleryPreviewItem[],
  initialIndex = 0
) {
  const list = images
    .map((item) => ({
      url: String(item.url || '').trim(),
      title: String(item.title || '').trim() || '参考图'
    }))
    .filter((item) => item.url)
  if (!list.length) return

  const GalleryPreviewContent = defineComponent({
    name: 'ImageGalleryPreviewContent',
    setup() {
      const index = ref(Math.min(Math.max(initialIndex, 0), list.length - 1))
      const viewerKey = ref(0)
      const current = computed(() => list[index.value]!)
      const hasMulti = list.length > 1

      const goPrev = () => {
        index.value = (index.value - 1 + list.length) % list.length
      }
      const goNext = () => {
        index.value = (index.value + 1) % list.length
      }

      watch(index, () => {
        viewerKey.value += 1
      })

      return () =>
        h('div', { class: 'image-gallery-preview-modal' }, [
          h('div', { class: 'image-gallery-preview-modal__stage-wrap' }, [
            hasMulti
              ? h(
                  'button',
                  {
                    class:
                      'image-gallery-preview-modal__nav image-gallery-preview-modal__nav--prev',
                    type: 'button',
                    'aria-label': '上一张',
                    onClick: goPrev
                  },
                  [h(LeftOutlined)]
                )
              : null,
            h(ImagePreviewViewer, {
              key: viewerKey.value,
              url: current.value.url,
              alt: current.value.title,
              headerTitle: current.value.title,
              fillStage: true,
              stageFitRatio: 1
            }),
            hasMulti
              ? h(
                  'button',
                  {
                    class:
                      'image-gallery-preview-modal__nav image-gallery-preview-modal__nav--next',
                    type: 'button',
                    'aria-label': '下一张',
                    onClick: goNext
                  },
                  [h(RightOutlined)]
                )
              : null
          ]),
          hasMulti
            ? h(
                'div',
                { class: 'image-gallery-preview-modal__counter' },
                `${index.value + 1} / ${list.length}`
              )
            : null
        ])
    }
  })

  Modal.info({
    icon: null,
    width: '100%',
    centered: false,
    closable: true,
    maskClosable: true,
    footer: null,
    style: { top: 0, paddingBottom: 0, margin: 0 },
    wrapClassName: 'image-gallery-preview-modal-wrap',
    content: h(GalleryPreviewContent)
  })
}
