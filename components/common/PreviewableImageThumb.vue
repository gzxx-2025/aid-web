<template>
  <div
    class="previewable-image-thumb"
    :class="{ 'previewable-image-thumb--disabled': !resolvedSrc }"
    @click.stop="handlePreview"
  >
    <ShimmerImage
      v-if="resolvedSrc"
      :src="resolvedSrc"
      :alt="alt"
      img-class="previewable-image-thumb__img"
      wrapper-class="previewable-image-thumb__shimmer"
      :object-fit="objectFit"
      reveal-direction="fade"
    />
    <div v-if="resolvedSrc" class="previewable-image-thumb__overlay" aria-hidden="true">
      <ZoomInOutlined class="previewable-image-thumb__zoom" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ZoomInOutlined } from '@ant-design/icons-vue'
import ShimmerImage from '~/components/common/ShimmerImage.vue'
import { openImagePreviewModal } from '~/utils/openImagePreviewModal'

const props = withDefaults(
  defineProps<{
    src?: string
    alt?: string
    title?: string
    objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  }>(),
  {
    src: '',
    alt: '',
    title: '',
    objectFit: 'contain'
  }
)

const resolvedSrc = computed(() => String(props.src || '').trim())

function handlePreview() {
  if (!resolvedSrc.value) return
  openImagePreviewModal({
    url: resolvedSrc.value,
    title: props.title || props.alt || '预览'
  })
}
</script>

<style scoped lang="scss">
.previewable-image-thumb {
  position: relative;
  width: 100%;
  height: 100%;
  cursor: zoom-in;
  overflow: hidden;
}

.previewable-image-thumb--disabled {
  cursor: default;
}

.previewable-image-thumb__shimmer {
  width: 100%;
  height: 100%;
}

.previewable-image-thumb :deep(.previewable-image-thumb__img) {
  width: 100%;
  height: 100%;
  min-width: 100%;
  display: block;
  object-position: center;
}

.previewable-image-thumb__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.42);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.previewable-image-thumb:hover .previewable-image-thumb__overlay {
  opacity: 1;
}

.previewable-image-thumb__zoom {
  font-size: 28px;
  color: #fff;
}
</style>
