<template>
  <div
    class="works-page home-new-sub-page works-library-figma"
    :class="{ 'works-library-figma--series-tab': workType === 'series' }"
  >
    <div class="page-content works-library-figma__inner">
      <header class="works-lib-header">
        <h1 class="works-lib-header__title">我的作品</h1>
      </header>

      <section class="works-lib-toolbar" aria-label="筛选与搜索">
        <div class="works-lib-type-tabs" role="tablist">
          <button
            v-for="tab in typeTabs"
            :key="tab.value"
            type="button"
            role="tab"
            :aria-selected="workType === tab.value"
            :class="['works-lib-type-tabs__btn', { 'is-active': workType === tab.value }]"
            @click="workType = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
        <div class="works-lib-search">
          <SearchOutlined class="works-lib-search__ico" />
          <input
            v-model="searchQuery"
            type="search"
            class="works-lib-search__input"
            placeholder="搜索作品..."
            autocomplete="off"
          />
        </div>
      </section>

      <div ref="worksLibGridRef" class="works-lib-grid">
        <WorksLibraryAddCard label="新建作品" @click="goToCreate" />
        <article
          v-for="(work, workIdx) in filteredWorks"
          :key="work.id"
          class="works-lib-card"
          :class="{ 'works-lib-card--series': work.category === 'series' }"
        >
          <div
            class="works-lib-card__cover"
            :class="{ 'works-lib-card__cover--placeholder': !work.hasCover }"
          >
            <img
              v-if="!work.hasCover"
              class="card-cover-placeholder-icon"
              :src="workCoverPlaceholderUrl"
              alt=""
              width="88"
              height="88"
              draggable="false"
            />
            <img
              v-else
              :key="`${workListRevision}-${work.id}`"
              class="works-lib-card__cover-img"
              :class="{ 'is-loaded': coverLoadedById[work.id] }"
              :src="work.coverImage"
              :alt="work.title"
              :data-work-id="work.id"
              loading="eager"
              decoding="async"
              @load="onWorkCoverLoad(work.id)"
              @error="onWorkCoverImgError($event, work.id)"
            />
            <div v-if="work.category === 'series'" class="works-lib-card__cover-meta">
              <h3 class="works-lib-card__cover-title">{{ work.title }}</h3>
              <span class="works-lib-card__cover-updated"
                >最后更新 {{ formatDate(work.updatedAt) }}</span
              >
            </div>
            <!-- 状态徽章独立于操作区：始终可见，避免与悬浮按钮叠在一起 -->
            <span
              v-if="work.pendingVideoUrl"
              class="works-lib-card__cover-badge works-lib-card__cover-badge--warn"
            >
              需重新审核
            </span>
            <span
              v-else-if="work.auditStatusLabel"
              class="works-lib-card__cover-badge"
              :class="auditBadgeClass(work.auditStatusTone)"
            >
              {{ work.auditStatusLabel }}
            </span>
            <span
              v-else-if="work.exportStatusLabel"
              class="works-lib-card__cover-badge"
              :class="{
                'works-lib-card__cover-badge--danger': work.exportStatusLabel === '合成失败'
              }"
            >
              {{ work.exportStatusLabel }}
            </span>
            <div class="works-lib-card__cover-actions">
              <button
                v-if="work.isPublic === '1'"
                type="button"
                class="works-lib-card__cover-btn works-lib-card__cover-btn--text"
                aria-label="关闭公开"
                @click.stop="unpublishWork(work)"
              >
                关闭公开
              </button>
              <button
                v-if="canSubmitAuditForWork(work)"
                type="button"
                class="works-lib-card__cover-btn works-lib-card__cover-btn--text"
                :aria-label="work.pendingVideoUrl ? '重新提交审核' : '提交审核'"
                @click.stop="submitWorkAudit(work)"
              >
                {{ work.pendingVideoUrl ? '重新提审' : '提交审核' }}
              </button>
              <button
                type="button"
                class="works-lib-card__cover-btn"
                aria-label="删除"
                @click.stop="deleteWork(work)"
              >
                <img src="../../assets//img/home//delete-white.svg" alt="" />
              </button>
              <button
                type="button"
                class="works-lib-card__cover-btn"
                aria-label="编辑"
                @click.stop="onWorkEditClick(work)"
              >
                <img src="../../assets//img/home/edit-white.svg" alt="" />
              </button>
            </div>
          </div>
          <div class="works-lib-card__body">
            <template v-if="work.category === 'series'">
              <div class="works-lib-card__episodes works-lib-card__episodes--series">
                <div class="works-lib-card__ep-toolbar">
                  <span class="works-lib-card__ep-label"
                    >集数 <em>{{ work.episodeCount ?? 0 }}</em></span
                  >
                  <button
                    type="button"
                    class="works-lib-card__ep-add works-lib-card__ep-add--primary"
                    :disabled="addingEpisodeProjectId === Number(work.id)"
                    aria-label="添加集"
                    @click.stop="addEpisodeFromCard(work)"
                  >
                    +
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <h3 class="works-lib-card__title">{{ work.title }}</h3>
              <div class="works-lib-card__row">
                <span class="works-lib-card__updated"
                  >最后更新 {{ formatDate(work.updatedAt) }}</span
                >
                <a-tooltip
                  title="发布至案例广场"
                  placement="top"
                  overlay-class-name="works-lib-publish-tooltip"
                >
                  <button
                    type="button"
                    class="works-lib-card__open"
                    aria-label="发布至案例广场"
                    @click.stop="publishToCasePlazaFromCard(work)"
                  >
                    <ExportOutlined />
                  </button>
                </a-tooltip>
              </div>
            </template>
          </div>
        </article>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { SearchOutlined, ExportOutlined } from '@ant-design/icons-vue'
import { message, Modal } from 'ant-design-vue'
import type { Work, CreationStep } from '~/types'
import type { UserProjectRow } from '~/types/business-api'
import {
  userProjectDelete,
  userProjectList,
  userProjectUnpublish,
  userProjectSubmitAudit,
  userEpisodeCreate
} from '~/utils/businessApi'
import {
  auditStatusBadgeLabel,
  auditStatusBadgeTone,
  auditSubmitBlockedReason,
  canSubmitAudit,
  exportStatusBadgeLabel,
  hasPendingReauditVideo,
  type AuditBadgeTone,
  isProjectPublicLockError,
  projectPublicLockUserHint
} from '~/utils/projectAudit'
import WorksLibraryAddCard from './WorksLibraryAddCard.vue'
import { emptyImageIconUrl as workCoverPlaceholderUrl } from '~/utils/emptyImageIcon'
import { CREATE_SERIES_EPISODE_LIST_PATH } from '~/utils/createFlowRoutes'
import { buildOpenProjectFlowQuery, resolveCreateFlowEntryPath } from '~/utils/createFlowProjectContext'
import {
  hydrateCreationStoreFromProjectDetail,
  resetProjectDetailHydrateCache
} from '~/utils/hydrateCreationStoreFromProjectDetail'

type WorkCategory = 'film' | 'series'

const emit = defineEmits<{
  /** 独立「我的作品」页：打开创建作品弹窗；携带当前列表 Tab 以预选电影/剧集 */
  'open-create': [tab: WorkCategory]
}>()

type WorkListItem = Work & {
  category: WorkCategory
  episodeCount?: number
  rawStatus?: number
  isPublic?: string | null
  hasCover: boolean
  finalVideoUrl?: string | null
  pendingVideoUrl?: string | null
  exportStatus?: number | null
  exportStatusLabel?: string | null
  auditStatusLabel?: string | null
  auditStatusTone?: AuditBadgeTone | null
}

const router = useRouter()
const route = useRoute()
const creationStore = useCreationStore()
const { beginEnterCreateFlowOverlay, endEnterCreateFlowOverlay } = useEnterCreateFlowOverlay()

function resolveWorksTabFromQuery(): WorkCategory {
  const raw = String(route.query.tab ?? route.query.type ?? '').toLowerCase()
  if (raw === 'series' || raw === 'tv') return 'series'
  if (raw === 'film' || raw === 'movie') return 'film'
  return 'film'
}

const workType = ref<WorkCategory>(resolveWorksTabFromQuery())
const searchQuery = ref('')

const typeTabs: { label: string; value: WorkCategory }[] = [
  { label: '电影/短片', value: 'film' },
  { label: '电视剧集', value: 'series' }
]

watch(
  () => [route.query.tab, route.query.type] as const,
  () => {
    workType.value = resolveWorksTabFromQuery()
  }
)

const myWorks = ref<WorkListItem[]>([])

/** 列表刷新代际：封面 img 重建 + 缓存图补标 is-loaded */
const workListRevision = ref(0)

const worksLibGridRef = ref<HTMLElement | null>(null)

/** 主封面图 decode 完成后再显示，切换 Tab 新列表在 fetch 成功后会清空 */
const coverLoadedById = ref<Record<string, boolean>>({})

function onWorkCoverLoad(workId: string) {
  coverLoadedById.value = { ...coverLoadedById.value, [workId]: true }
}

/** 浏览器缓存命中时 @load 可能早于监听绑定，需在 DOM 更新后补检 img.complete */
function syncCoverLoadedFromCache() {
  const root = worksLibGridRef.value
  if (!root) return
  const imgs = root.querySelectorAll<HTMLImageElement>(
    'img.works-lib-card__cover-img[data-work-id]'
  )
  if (!imgs.length) return
  const next = { ...coverLoadedById.value }
  let changed = false
  imgs.forEach((img) => {
    const workId = img.dataset.workId
    if (!workId || next[workId]) return
    if (img.complete && img.naturalWidth > 0) {
      next[workId] = true
      changed = true
    }
  })
  if (changed) {
    coverLoadedById.value = next
  }
}

function onWorkCoverImgError(ev: Event, workId: string) {
  const el = ev.target as HTMLImageElement | null
  if (!el || el.dataset.coverFallback === '1') return
  el.dataset.coverFallback = '1'
  const idx = myWorks.value.findIndex((w) => w.id === workId)
  if (idx >= 0) {
    myWorks.value[idx] = {
      ...myWorks.value[idx],
      hasCover: false,
      coverImage: workCoverPlaceholderUrl
    }
  }
}

/** 卡片添加分集进行中的作品 id */
const addingEpisodeProjectId = ref<number | null>(null)

async function addEpisodeFromCard(work: WorkListItem) {
  const projectId = Number(work.id)
  if (!Number.isFinite(projectId) || projectId <= 0) {
    message.error('项目ID无效')
    return
  }
  addingEpisodeProjectId.value = projectId
  try {
    const nextNo = Math.max(0, Number(work.episodeCount) || 0) + 1
    await userEpisodeCreate({
      projectId,
      comicTitle: `第${nextNo}集`
    })
    message.success('已新增一集')
    await fetchWorkList()
  } catch (e: unknown) {
    if (isProjectPublicLockError(e)) {
      message.error(projectPublicLockUserHint())
      return
    }
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '新增失败')
  } finally {
    addingEpisodeProjectId.value = null
  }
}

async function goToSeriesEpisodeManage(work: WorkListItem) {
  const projectId = Number(work.id)
  if (!Number.isFinite(projectId) || projectId <= 0) {
    message.error('项目ID无效')
    return
  }
  beginEnterCreateFlowOverlay()
  try {
    resetProjectDetailHydrateCache(projectId)
    const q = buildOpenProjectFlowQuery(projectId, {
      embedded: false,
      projectType: 'series'
    })
    // 先对齐路由再 hydrate，避免 store 已切、route 仍旧时把上一作品 loading 灌回
    await router.push({ path: CREATE_SERIES_EPISODE_LIST_PATH, query: q })
    await hydrateCreationStoreFromProjectDetail(creationStore, projectId, { force: true })
    creationStore.setSeriesFlowEnteredStoryScript(false)
  } catch {
    endEnterCreateFlowOverlay()
    message.error('进入剧集管理失败，请稍后重试')
  }
}

function onWorkEditClick(work: Work) {
  const item = work as WorkListItem
  if (item.category === 'series') {
    void goToSeriesEpisodeManage(item)
    return
  }
  void openWork(work)
}

function toWorkStatus(status?: number): Work['status'] {
  if (status === 4) return 'completed'
  if (status === 1 || status === 2 || status === 3) return 'in-progress'
  return 'draft'
}

function toCurrentStep(status?: number): CreationStep {
  if (status === 4) return 'preview'
  if (status === 1 || status === 2 || status === 3) return 'dubbing'
  return 'global-setting'
}

function mapProjectToWorkItem(row: UserProjectRow): WorkListItem {
  const pt = String(row.projectType ?? '').toLowerCase()
  const category: WorkCategory = pt === 'series' ? 'series' : 'film'
  const coverRaw = (row.coverUrl || '').trim()
  const ec = row.episodeCount
  const episodeCount =
    typeof ec === 'number' && Number.isFinite(ec) ? Math.max(0, Math.floor(ec)) : 0
  return {
    id: String(row.id),
    title: row.projectName || '未命名草稿',
    description: row.projectDesc || '',
    coverImage: coverRaw || workCoverPlaceholderUrl,
    hasCover: !!coverRaw,
    author: { id: '0', username: '我', email: 'me@example.com', role: 'user' },
    createdAt: row.createTime || '',
    updatedAt: row.updateTime || row.createTime || '',
    status: toWorkStatus(row.status),
    views: 0,
    likes: 0,
    tags: [],
    currentStep: toCurrentStep(row.status),
    category,
    episodeCount,
    rawStatus: row.status,
    isPublic: row.isPublic ?? null,
    finalVideoUrl: row.finalVideoUrl ?? null,
    pendingVideoUrl: row.pendingVideoUrl ?? null,
    exportStatus: row.exportStatus ?? null,
    exportStatusLabel: exportStatusBadgeLabel(row.exportStatus),
    auditStatusLabel: auditStatusBadgeLabel(row.status, row.isPublic),
    auditStatusTone: auditStatusBadgeTone(row.status, row.isPublic)
  }
}

function auditBadgeClass(tone?: AuditBadgeTone | null): string {
  if (tone === 'reviewing') return 'works-lib-card__cover-badge--reviewing'
  if (tone === 'failed') return 'works-lib-card__cover-badge--failed'
  if (tone === 'published') return 'works-lib-card__cover-badge--published'
  if (tone === 'passed') return 'works-lib-card__cover-badge--passed'
  return ''
}

function hasSynthesizedVideo(work: WorkListItem): boolean {
  // exportStatus=2 已合成；或已有成片/待审新片地址
  if (work.exportStatus === 2) return true
  if (String(work.pendingVideoUrl || '').trim()) return true
  if (String(work.finalVideoUrl || '').trim()) return true
  return false
}

function canSubmitAuditForWork(work: WorkListItem): boolean {
  // 没有合成视频前不展示「提交审核」
  if (!hasSynthesizedVideo(work)) return false
  return canSubmitAudit({ status: work.rawStatus, pendingVideoUrl: work.pendingVideoUrl })
}

async function submitWorkAudit(work: WorkListItem) {
  const projectId = Number(work.id)
  if (!Number.isFinite(projectId) || projectId <= 0) return
  const blocked = auditSubmitBlockedReason({
    status: work.rawStatus,
    pendingVideoUrl: work.pendingVideoUrl
  })
  if (blocked) {
    message.warning(blocked)
    return
  }
  try {
    if (work.category === 'series') {
      await userProjectSubmitAudit({ id: projectId })
        message.success(
          hasPendingReauditVideo({
            pendingVideoUrl: work.pendingVideoUrl
          })
            ? '项目新片已重新提交审核'
            : '项目已提交审核'
        )
      } else {
        await userProjectSubmitAudit({ id: projectId })
        message.success(
          hasPendingReauditVideo({
            pendingVideoUrl: work.pendingVideoUrl
          })
            ? '新片已重新提交审核'
            : '项目已提交审核'
        )
    }
    await fetchWorkList()
  } catch (e: unknown) {
    if (isProjectPublicLockError(e)) {
      message.error(projectPublicLockUserHint())
      return
    }
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '提交审核失败')
  }
}

const publishNavigatingProjectId = ref<number | null>(null)

/**
 * 卡片右下角「发布至案例广场」：不再在列表内走发布/审核，
 * 而是跳转到作品当前进行到的流程步骤（已完成则为成品预览），
 * 由创作流程壳层根据 publishGuide 标记高亮引导：
 * 未完成 → 当前流程 tab；已完成 →「导出/发布」。
 */
async function publishToCasePlazaFromCard(work: WorkListItem) {
  const projectId = Number(work.id)
  if (!Number.isFinite(projectId) || projectId <= 0) {
    message.error('项目ID无效')
    return
  }
  if (publishNavigatingProjectId.value != null) return
  publishNavigatingProjectId.value = projectId
  beginEnterCreateFlowOverlay()
  try {
    resetProjectDetailHydrateCache(projectId)
    const projectTypeGuess = work.category === 'series' ? 'series' : 'movie'
    const q = buildOpenProjectFlowQuery(projectId, {
      embedded: false,
      projectType: projectTypeGuess
    })
    const entryPath = await resolveCreateFlowEntryPath(projectId, projectTypeGuess)
    await router.push({ path: entryPath, query: { ...q, publishGuide: '1' } })
    await hydrateCreationStoreFromProjectDetail(creationStore, projectId, { force: true })
    const projectType = creationStore.currentProjectType
    if (projectType && projectType !== projectTypeGuess) {
      const q2 = buildOpenProjectFlowQuery(projectId, {
        embedded: false,
        projectType
      })
      const entryPath2 = await resolveCreateFlowEntryPath(projectId, projectType)
      await router.replace({ path: entryPath2, query: { ...q2, publishGuide: '1' } })
    }
  } catch {
    endEnterCreateFlowOverlay()
    message.error('获取项目详情失败，请稍后重试')
  } finally {
    publishNavigatingProjectId.value = null
  }
}

async function unpublishWork(work: WorkListItem) {
  const projectId = Number(work.id)
  if (!Number.isFinite(projectId) || projectId <= 0) return
  Modal.confirm({
    title: '确认关闭公开？',
    content: '关闭后作品将从案例广场下架，您可继续修改内容。',
    okText: '关闭公开',
    cancelText: '取消',
    onOk: async () => {
      try {
        await userProjectUnpublish({ id: projectId })
        message.success('已关闭公开')
        await fetchWorkList()
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '关闭公开失败')
        throw e
      }
    }
  })
}

let latestFetchToken = 0

async function fetchWorkList() {
  const fetchToken = ++latestFetchToken
  try {
    const { rows } = await userProjectList({
      projectType: workType.value === 'film' ? 'movie' : 'series',
      projectName: searchQuery.value.trim() || undefined
    })
    if (fetchToken !== latestFetchToken) return
    coverLoadedById.value = {}
    workListRevision.value += 1
    myWorks.value = rows.map(mapProjectToWorkItem)
    await nextTick()
    syncCoverLoadedFromCache()
  } catch (_error) {
    if (fetchToken !== latestFetchToken) return
    coverLoadedById.value = {}
    myWorks.value = []
    message.error('查询项目列表失败，请稍后重试')
  }
}

const filteredWorks = computed(() => {
  let list = myWorks.value.filter((w) => w.category === workType.value)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(
      (w) => w.title.toLowerCase().includes(q) || w.description.toLowerCase().includes(q)
    )
  }
  return list
})

const formatDate = (dateString: string) => {
  if (!dateString) return '--'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

/** 单一入口：挂载时拉一次，切换 Tab 再拉；避免 onMounted + watch 叠成双请求 */
watch(
  workType,
  () => {
    void fetchWorkList()
  },
  { immediate: true }
)

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void fetchWorkList()
  }, 300)
})

onBeforeUnmount(() => {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
})

function goToCreate() {
  emit('open-create', workType.value)
}

async function openWork(work: Work) {
  const projectId = Number(work.id)
  if (!Number.isFinite(projectId) || projectId <= 0) {
    message.error('项目ID无效')
    return
  }
  const item = work as WorkListItem
  const projectTypeGuess = item.category === 'series' ? 'series' : 'movie'
  beginEnterCreateFlowOverlay()
  try {
    resetProjectDetailHydrateCache(projectId)
    const q = buildOpenProjectFlowQuery(projectId, {
      embedded: false,
      projectType: projectTypeGuess
    })
    const entryPath = await resolveCreateFlowEntryPath(projectId, projectTypeGuess)
    // 先对齐路由再 hydrate，避免 store↔route 分歧窗口把旧作品 generating 灌进新作品
    await router.push({ path: entryPath, query: q })
    await hydrateCreationStoreFromProjectDetail(creationStore, projectId, { force: true })
    const projectType = creationStore.currentProjectType
    if (projectType && projectType !== projectTypeGuess) {
      const q2 = buildOpenProjectFlowQuery(projectId, {
        embedded: false,
        projectType
      })
      const entryPath2 = await resolveCreateFlowEntryPath(projectId, projectType)
      await router.replace({ path: entryPath2, query: q2 })
    }
  } catch (_error) {
    endEnterCreateFlowOverlay()
    message.error('获取项目详情失败，请稍后重试')
  }
}

function deleteWork(work: Work) {
  Modal.confirm({
    class: 'home-confirm-modal',
    wrapClassName: 'create-flow-modal home-confirm-wrap',
    centered: true,
    title: '删除作品',
    content: `确认删除《${work.title}》吗？`,
    okText: '删除',
    cancelText: '取消',
    okType: 'danger',
    async onOk() {
      const projectId = Number(work.id)
      if (!Number.isFinite(projectId) || projectId <= 0) {
        message.error('项目ID无效')
        return
      }
      await userProjectDelete(projectId)
      message.success('删除成功')
      await fetchWorkList()
    }
  })
}
</script>

<style lang="scss" scoped>
/* 封面区尺寸与占位样式见 assets/css/home-theme.css */

.works-lib-card:hover .works-lib-card__cover-img.is-loaded {
  transform: scale(1.04);
}

/* 剧集：标题 + 日期叠在封面左下角 */
.works-lib-card__cover-meta {
  position: absolute;
  left: 10px;
  bottom: 8px;
  right: 56px;
  z-index: 2;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.works-lib-card__cover-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.25;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.works-lib-card__cover-updated {
  font-size: 12px;
  line-height: 1.2;
  color: rgba(230, 237, 243, 0.88);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.works-lib-card__cover-actions {
  z-index: 3;
}

.works-lib-grid {
  grid-auto-rows: max-content;
}

/* 电视剧集 Tab：新建卡片与剧集卡片同高；电影/短片 Tab 不受影响 */
.works-library-figma--series-tab {
  --works-lib-body-h: 56px;
}

.works-library-figma--series-tab .works-lib-grid {
  align-items: stretch;
}

.works-library-figma--series-tab .works-lib-card,
.works-library-figma--series-tab :deep(.works-lib-add-card) {
  align-self: stretch;
  height: auto;
}

.works-library-figma--series-tab :deep(.works-lib-add-card__body) {
  height: auto;
  min-height: var(--works-lib-body-h, 118px);
  flex: 1 0 auto;
}

/* 剧集卡片底部：仅展示总集数与添加按钮 */
.works-lib-card--series .works-lib-card__body {
  display: flex;
  flex-direction: column;
  padding: 0 12px 12px;
  box-sizing: border-box;
  height: auto;
  min-height: var(--works-lib-body-h, 118px);
  overflow: visible;
}

.works-lib-card__episodes--series {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 6px;
  min-height: 0;
  padding-top: 10px;
  margin-top: 0;
  border-top: 1px solid rgba(74, 231, 253, 0.12);
  box-sizing: border-box;
}

.works-lib-card__ep-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  flex-shrink: 0;
  min-height: 32px;
  box-sizing: border-box;
}

.works-lib-card__ep-label {
  font-size: 14px;
  font-weight: 500;
  color: #fff;

  em {
    margin-left: 6px;
    font-style: normal;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.88);
  }
}

.works-lib-card__ep-add--primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 8px;
  border: none;
  background: linear-gradient(270deg, #0e59fa, #00abd8);
  color: #fff;
  font-size: 18px;
  line-height: 1;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(14, 89, 250, 0.25);

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    filter: none;
  }
}

.works-lib-card__ep-add--primary:hover:not(:disabled) {
  filter: brightness(1.06);
}

/* 文字操作按钮：覆盖圆形图标按钮的固定宽高，做成胶囊形 */
.works-lib-card__cover-btn--text {
  width: auto !important;
  min-width: 52px;
  height: 28px !important;
  padding: 0 10px;
  border-radius: 14px;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  color: #fff;
  background: rgba(14, 89, 250, 0.88) !important;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.works-lib-card__cover-btn--text:hover {
  background: rgba(14, 89, 250, 1) !important;
  filter: brightness(1.06);
}

.works-lib-card__cover-badge {
  position: absolute;
  left: 10px;
  top: 10px;
  z-index: 2;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
  color: #fff;
  background: rgba(14, 89, 250, 0.82);
  pointer-events: none;
  white-space: nowrap;
}

/* 审核中 — 设计稿浅蓝胶囊 */
.works-lib-card__cover-badge--reviewing {
  background: linear-gradient( 270deg, #0E59FA 0%, #00ABD8 100%);
}

/* 审核失败 — 设计稿浅红/粉胶囊 */
.works-lib-card__cover-badge--failed {
  background: #FF6969;
}

/* 已发布 — 设计稿深色半透明胶囊 */
.works-lib-card__cover-badge--published {
  background: rgba(28, 32, 40, 0.78);
}

/* 审核通过但未公开 */
.works-lib-card__cover-badge--passed {
  background: rgba(46, 160, 140, 0.9);
}

.works-lib-card__cover-badge--warn {
  background: rgba(250, 140, 22, 0.92);
}

.works-lib-card__cover-badge--danger {
  background: rgba(245, 63, 63, 0.9);
}
</style>

<style>
/* 发布按钮 hover 提示：深色渐变气泡（设计稿样式），teleport 到 body 不能 scoped */
.works-lib-publish-tooltip .ant-tooltip-inner {
  padding: 6px 12px;
  border-radius: 8px;
  background: linear-gradient(270deg, #444444 0%, #2b2b2b 100%);
  border: none;
  box-shadow: 0 8px 24px rgba(8, 12, 24, 0.45);
  color: #fff;
  font-size: 13px;
  line-height: 1.4;
  white-space: nowrap;
  min-height: 0;
}

.works-lib-publish-tooltip .ant-tooltip-arrow::before,
.works-lib-publish-tooltip .ant-tooltip-arrow::after {
  background: #353535;
}
</style>
