<template>
  <div class="case-detail-root">
    <div class="case-detail-bg" aria-hidden="true">
      <img v-if="coverUrl" :src="coverUrl" alt="" class="case-detail-bg-img" />
      <div class="case-detail-bg-glow" />
    </div>

    <div v-if="loading" class="case-detail-loading" role="status">加载中...</div>

    <div v-else-if="errorMessage" class="case-detail-error">
      <p>{{ errorMessage }}</p>
      <button type="button" class="case-detail-back-btn" aria-label="返回" @click="goBack">
        <img :src="iconReturnUrl" alt="" width="36" height="36" />
      </button>
    </div>

    <div v-else class="case-detail-page">
      <section class="case-detail-main" aria-label="案例视频">
        <header class="case-detail-nav">
          <button type="button" class="case-detail-back-btn" aria-label="返回" @click="goBack">
            <img :src="iconReturnUrl" alt="" width="36" height="36" />
          </button>
        </header>

        <div class="case-detail-player-area">
          <div class="case-detail-video-wrap">
            <video
              v-if="videoUrl"
              ref="videoRef"
              class="case-detail-video"
              :src="videoUrl"
              :poster="coverUrl || undefined"
              controls
              playsinline
              preload="metadata"
            />
            <img
              v-else-if="coverUrl"
              :src="coverUrl"
              :alt="projectName"
              class="case-detail-cover"
            />
          </div>
        </div>
      </section>

      <aside class="case-detail-sidebar" aria-label="案例信息">
        <div class="case-detail-user">
          <img :src="userBlueIcon" alt="" class="case-detail-user-avatar" width="36" height="36" />
          <span class="case-detail-user-name">{{ authorName }}</span>
        </div>

        <h1 class="case-detail-title">{{ projectName }}</h1>
        <p class="case-detail-type">{{ videoTypeLabel }}</p>
        <p class="case-detail-desc">{{ descriptionText }}</p>

        <section v-if="showProtagonists" aria-labelledby="case-protagonists-title">
          <h2 id="case-protagonists-title" class="case-detail-section-title">故事主角</h2>
          <div class="case-detail-protagonists">
            <div
              v-for="(item, index) in protagonistItems"
              :key="`${item.imageUrl}-${index}`"
              class="case-detail-protagonist"
              :class="{ 'case-detail-protagonist--empty': !item.imageUrl }"
            >
              <img
                v-if="item.imageUrl"
                :src="item.imageUrl"
                :alt="item.name || '故事主角'"
                loading="lazy"
              />
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import iconReturnUrl from '~/assets/img/icon/icon-return.svg'
import userBlueIcon from '~/assets/img/home/Group-avtor.svg'
import { publicProjectDetail } from '~/utils/businessApi'
import type { PublicProjectDetailRow } from '~/types/business-api'

definePageMeta({
  layout: false
})

interface ProtagonistItem {
  name?: string
  imageUrl?: string
}

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const errorMessage = ref('')
const detail = ref<PublicProjectDetailRow | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)

const projectId = computed(() => {
  const raw = route.params.id
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
})

const projectName = computed(() => detail.value?.projectName || '影片名称')
const coverUrl = computed(() => detail.value?.coverUrl || '')
const videoUrl = computed(() => detail.value?.finalVideoUrl || '')
const videoTypeLabel = computed(() => detail.value?.videoStyleType || '影片的类型')
const authorName = computed(() => {
  const row = detail.value as
    | (PublicProjectDetailRow & { authorName?: string; userName?: string })
    | null
  return row?.authorName || row?.userName || '用户'
})
const descriptionText = computed(() => {
  const desc = detail.value?.projectDesc?.trim()
  return desc || '剧情介绍...'
})

const protagonistItems = computed<ProtagonistItem[]>(() => {
  const row = detail.value as
    | (PublicProjectDetailRow & {
        characterList?: ProtagonistItem[]
        protagonists?: ProtagonistItem[]
        roleList?: ProtagonistItem[]
      })
    | null
  const list = row?.characterList || row?.protagonists || row?.roleList
  if (Array.isArray(list) && list.length) {
    return list.slice(0, 8)
  }
  return []
})

const showProtagonists = computed(() => protagonistItems.value.length > 0)

function resolveBackTarget() {
  return '/'
}

function goBack() {
  if (import.meta.client && window.history.length > 1) {
    router.back()
    return
  }
  router.push(resolveBackTarget())
}

async function loadDetail() {
  if (!projectId.value) {
    errorMessage.value = '无效的案例 ID'
    loading.value = false
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    detail.value = await publicProjectDetail(projectId.value)
  } catch {
    errorMessage.value = '加载案例详情失败，请稍后重试'
    detail.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => route.params.id,
  () => {
    loadDetail()
  }
)

onMounted(async () => {
  await loadDetail()
  await nextTick()
  videoRef.value?.play().catch(() => {})
})

useHead({
  title: computed(() =>
    detail.value?.projectName ? `${detail.value.projectName} - 案例详情` : '案例详情'
  ),
  htmlAttrs: {
    class: 'app-shell-create case-detail-shell'
  }
})
</script>

<style>
@import '~/assets/css/case-detail-page.css';

html.case-detail-shell,
html.case-detail-shell body {
  min-height: 100%;
  background: #060a12;
  color: #fff;
  overflow: auto;
}
</style>
