<template>
  <!-- 与 components/home/AssetsLibraryPanel.vue 中资产卡片 DOM 结构一致 -->
  <article class="works-lib-card">
    <div class="works-lib-card__cover">
      <img
        :key="props.coverImage || '__default__'"
        :src="displayCover"
        :alt="title"
        @error="onCoverImgError"
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
      <div class="works-lib-card__row works-lib-card__row--asset">
        <span class="works-lib-card__from">{{ fromLabel }}</span>
        <div class="works-lib-card__row-trailing">
          <span class="works-lib-card__updated">{{ formatDate(dateLabel) }}</span>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import deleteWhite from '~/assets/img/home/delete-white.svg'
import editWhite from '~/assets/img/home/edit-white.svg'
import defaultCoverUrl from '~/assets/img/home/pic_bg.svg'

const props = defineProps<{
  title: string
  coverImage: string
  /** 与资产库一致，如「来自: 项目 #123」 */
  fromLabel: string
  /** 展示在右侧的日期（与资产库一致为纯日期，无「最后更新」前缀） */
  dateLabel: string
}>()

const displayCover = ref(resolveCover(props.coverImage))

watch(
  () => props.coverImage,
  (url) => {
    displayCover.value = resolveCover(url)
  }
)

function resolveCover(url: string | undefined) {
  const t = (url || '').trim()
  return t || defaultCoverUrl
}

function onCoverImgError(ev: Event) {
  const el = ev.target as HTMLImageElement | null
  if (!el || el.dataset.coverFallback === '1') return
  el.dataset.coverFallback = '1'
  displayCover.value = defaultCoverUrl
}

defineEmits<{
  delete: []
  edit: []
}>()

function formatDate(dateString: string) {
  if (!dateString) return '--'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
</script>
