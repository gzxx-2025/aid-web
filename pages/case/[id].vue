<template>
  <div class="case-detail-root">
    <div class="case-detail-bg" aria-hidden="true">
      <img v-if="activeCoverUrl" :src="activeCoverUrl" alt="" class="case-detail-bg-img" />
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
              v-if="activeVideoUrl"
              ref="videoRef"
              class="case-detail-video"
              :src="activeVideoUrl"
              :poster="activeCoverUrl || undefined"
              controls
              playsinline
              preload="metadata"
            />
            <img
              v-else-if="activeCoverUrl"
              :src="activeCoverUrl"
              :alt="projectName"
              class="case-detail-cover"
            />
          </div>

          <div v-if="episodes.length > 1" class="case-detail-episodes" aria-label="剧集列表">
            <button
              v-for="ep in episodes"
              :key="ep.episodeId"
              type="button"
              class="case-detail-episode-btn"
              :class="{ 'is-active': activeEpisodeId === ep.episodeId }"
              @click="selectEpisode(ep.episodeId)"
            >
              <img
                v-if="ep.coverUrl"
                :src="ep.coverUrl"
                :alt="ep.title || `第${ep.episodeNo}集`"
                class="case-detail-episode-cover"
              />
              <span class="case-detail-episode-title">
                {{ ep.title || `第${ep.episodeNo}集` }}
              </span>
            </button>
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
              <img
                v-else
                :src="emptyImageIconUrl"
                alt=""
                class="empty-image-icon empty-image-icon--md case-detail-protagonist__empty-icon"
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
import { emptyImageIconUrl } from '~/utils/emptyImageIcon'
import userBlueIcon from '~/assets/img/home/Group-avtor.svg'
import { publicProjectDetail } from '~/utils/businessApi'
import type { PublicProjectDetailRow, PublicProjectEpisodeItem } from '~/types/business-api'

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
const activeEpisodeId = ref<number | null>(null)
let detailLoadGen = 0

const projectId = computed(() => {
  const raw = route.params.id
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
})

const projectName = computed(() => detail.value?.projectName || '影片名称')
const episodes = computed<PublicProjectEpisodeItem[]>(() => {
  const list = detail.value?.episodes
  return Array.isArray(list) ? list : []
})

const activeEpisode = computed(() => {
  if (!episodes.value.length) return null
  const hit = episodes.value.find((ep) => ep.episodeId === activeEpisodeId.value)
  return hit || episodes.value[0] || null
})

const activeCoverUrl = computed(() => {
  const epCover = String(activeEpisode.value?.coverUrl || '').trim()
  if (epCover) return epCover
  return detail.value?.coverUrl || ''
})

const activeVideoUrl = computed(() => {
  const epVideo = String(activeEpisode.value?.videoUrl || '').trim()
  if (epVideo) return epVideo
  return detail.value?.finalVideoUrl || ''
})

const videoTypeLabel = computed(() => detail.value?.videoStyleType || '影片的类型')
const authorName = computed(() => {
  const name = String(detail.value?.authorNickname || '').trim()
  return name || '用户'
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

function selectEpisode(episodeId: number) {
  if (activeEpisodeId.value === episodeId) return
  activeEpisodeId.value = episodeId
  nextTick(() => {
    videoRef.value?.play().catch(() => {})
  })
}

async function loadDetail() {
  const gen = ++detailLoadGen
  if (!projectId.value) {
    errorMessage.value = '无效的案例 ID'
    loading.value = false
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const row = await publicProjectDetail(projectId.value)
    if (gen !== detailLoadGen) return
    detail.value = row
    const firstEp = Array.isArray(row.episodes) ? row.episodes[0] : null
    activeEpisodeId.value = firstEp?.episodeId ?? null
  } catch {
    if (gen !== detailLoadGen) return
    errorMessage.value = '加载案例详情失败，请稍后重试'
    detail.value = null
    activeEpisodeId.value = null
  } finally {
    if (gen === detailLoadGen) {
      loading.value = false
    }
  }
}

watch(
  () => route.params.id,
  async () => {
    await loadDetail()
    await nextTick()
    videoRef.value?.play().catch(() => {})
  },
  { immediate: true }
)

useHead({
  title: computed(() =>
    detail.value?.projectName ? `${detail.value.projectName} - 案例详情` : '案例详情'
  ),
  htmlAttrs: {
    class: 'case-detail-html'
  }
})
</script>

<style>
@import '~/assets/css/case-detail-page.css';
</style>

<style scoped>
.case-detail-episodes {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 12px 4px 0;
  width: 100%;
}

.case-detail-episode-btn {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  width: 120px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.28);
  color: rgba(255, 255, 255, 0.78);
  cursor: pointer;
  overflow: hidden;
}

.case-detail-episode-btn.is-active {
  border-color: rgba(74, 231, 253, 0.65);
  color: #fff;
}

.case-detail-episode-cover {
  width: 100%;
  height: 68px;
  object-fit: cover;
  display: block;
}

.case-detail-episode-title {
  padding: 0 8px 8px;
  font-size: 12px;
  line-height: 1.35;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  box-sizing: border-box;
}
</style>
