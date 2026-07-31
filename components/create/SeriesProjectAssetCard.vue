<template>
  <!-- 与 components/home/AssetsLibraryPanel.vue 中资产卡片 DOM 结构一致 -->
  <article class="works-lib-card" @click="openPreview">
    <div
      class="works-lib-card__cover"
      :class="{ 'works-lib-card__cover--placeholder': !hasRealCover }"
    >
      <ShimmerImage
        v-if="hasRealCover"
        :src="displayCover"
        :alt="title"
        img-class="works-lib-card__cover-img"
        wrapper-class="works-lib-card__cover-shimmer"
        object-fit="cover"
        reveal-direction="fade"
        :min-shimmer-ms="280"
        @error="onCoverError"
      />
      <img
        v-else
        class="card-cover-placeholder-icon"
        :src="defaultCoverUrl"
        alt=""
        width="88"
        height="88"
        draggable="false"
      />
      <div class="works-lib-card__cover-actions">
        <button
          type="button"
          class="works-lib-card__cover-btn"
          aria-label="删除"
          @click.stop="$emit('delete')"
        >
          <img :src="deleteWhite" alt="" width="16" height="16">
        </button>
        <button
          type="button"
          class="works-lib-card__cover-btn"
          aria-label="编辑"
          @click.stop="$emit('edit')"
        >
          <img :src="editWhite" alt="" width="16" height="16">
        </button>
      </div>
    </div>
    <div class="works-lib-card__body">
      <h3 class="works-lib-card__title">{{ title }}</h3>
      <div v-if="formattedDate" class="works-lib-card__row works-lib-card__row--asset">
        <span class="works-lib-card__from">生成日期：{{ formattedDate }}</span>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { message } from 'ant-design-vue'
import deleteWhite from '~/assets/img/home/delete-white.svg'
import editWhite from '~/assets/img/home/edit-white.svg'
import ShimmerImage from '~/components/common/ShimmerImage.vue'
import { emptyImageIconUrl as defaultCoverUrl } from '~/utils/emptyImageIcon'
import { openImagePreviewModal } from '~/utils/openImagePreviewModal'

const props = defineProps<{
  title: string
  coverImage: string
  /** 接口 createTime / updateTime，有则展示为生成日期 */
  dateLabel?: string
}>()

const displayCover = ref(resolveCover(props.coverImage))
const coverFailed = ref(false)
const hasRealCover = computed(() => {
  if (coverFailed.value) return false
  const url = (displayCover.value || '').trim()
  return !!url && url !== defaultCoverUrl
})

watch(
  () => props.coverImage,
  (url) => {
    coverFailed.value = false
    displayCover.value = resolveCover(url)
  }
)

function resolveCover(url: string | undefined) {
  const t = (url || '').trim()
  return t || defaultCoverUrl
}

function onCoverError() {
  coverFailed.value = true
  displayCover.value = defaultCoverUrl
}

function openPreview() {
  if (!hasRealCover.value) {
    message.info('该资产暂无图片可预览')
    return
  }
  openImagePreviewModal({
    url: displayCover.value,
    title: props.title
  })
}

defineEmits<{
  delete: []
  edit: []
}>()

const formattedDate = computed(() => {
  const raw = (props.dateLabel || '').trim()
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
})
</script>

<style scoped>
.works-lib-card__body {
  height: auto;
  min-height: 0;
  padding: 10px 12px 12px;
}

.works-lib-card__cover :deep(.works-lib-card__cover-shimmer) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.works-lib-card__cover :deep(.works-lib-card__cover-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  transition: transform 0.35s ease;
}

.works-lib-card:hover .works-lib-card__cover :deep(.works-lib-card__cover-img) {
  transform: scale(1.04);
}
</style>
