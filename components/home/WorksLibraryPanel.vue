<template>
  <div class="works-page home-sub-page works-library-figma">
    <div class="page-content works-library-figma__inner">
      <header class="works-lib-header">
        <h1 class="works-lib-header__title">我的作品</h1>
      </header>

      <!-- <section class="works-lib-stats" aria-label="作品统计">
        <div
          v-for="item in statItems"
          :key="item.key"
          class="works-lib-stat-card"
        >
          <span class="works-lib-stat-card__label">{{ item.label }}</span>
          <span class="works-lib-stat-card__value">{{ item.value }}</span>
        </div>
      </section> -->

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

      <div class="works-lib-grid">
        <WorksLibraryAddCard label="新建作品" @click="goToCreate" />
        <article
          v-for="work in filteredWorks"
          :key="work.id"
          class="works-lib-card"
          :class="{ 'works-lib-card--series': work.category === 'series' }"
        >
          <div class="works-lib-card__cover">
            <!-- 底层占位：Tab 切换或远程封面未返回前立即可见，避免纯黑块 -->
            <img
              class="works-lib-card__cover-underlay"
              :src="workCoverPlaceholderUrl"
              alt=""
              width="294"
              height="166"
              draggable="false"
            />
            <img
              class="works-lib-card__cover-img"
              :class="{
                'is-loaded': coverLoadedById[work.id] || work.coverImage === workCoverPlaceholderUrl
              }"
              :src="work.coverImage"
              :alt="work.title"
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
            <div class="works-lib-card__cover-actions">
              <button
                v-if="work.rawStatus === 4 && work.isPublic !== '1'"
                type="button"
                class="works-lib-card__cover-btn works-lib-card__cover-btn--text"
                aria-label="公开作品"
                @click.stop="publishWork(work)"
              >
                公开
              </button>
              <button
                v-if="work.category === 'series' && canSubmitProjectAudit(work)"
                type="button"
                class="works-lib-card__cover-btn works-lib-card__cover-btn--text"
                aria-label="提交项目审核"
                @click.stop="submitProjectAudit(work)"
              >
                提交审核
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
                  <span class="works-lib-card__ep-label">集数</span>
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
                <div class="works-lib-card__ep-pills-row">
                  <template v-for="item in displayedEpisodePills(work)" :key="item.key">
                    <button
                      v-if="item.type === 'ep'"
                      type="button"
                      class="works-lib-card__ep-num"
                      @click.stop="onEpisodePillClickById(work, item.id)"
                    >
                      {{ item.no }}
                    </button>
                    <a-popover
                      v-else
                      :open="activeEpisodePopoverId === work.id"
                      trigger="click"
                      placement="bottom"
                      overlay-class-name="works-lib-ep-popover"
                      @update:open="(open) => onEpisodePopoverOpenChange(open, work)"
                    >
                      <template #content>
                        <div
                          v-if="episodePopoverLoadingId === work.id"
                          class="works-lib-ep-popover__loading"
                        >
                          加载中…
                        </div>
                        <div
                          v-else-if="!episodesForWork(work).length"
                          class="works-lib-ep-popover__empty"
                        >
                          暂无分集
                        </div>
                        <div v-else class="works-lib-ep-popover__grid">
                          <button
                            v-for="ep in episodesForWork(work)"
                            :key="ep.id"
                            type="button"
                            class="works-lib-ep-popover__btn"
                            @click="selectEpisodeFromPopover(work, ep)"
                          >
                            {{ ep.episodeNo ?? '—' }}
                          </button>
                        </div>
                      </template>
                      <button
                        type="button"
                        class="works-lib-card__ep-ellipsis"
                        aria-label="查看全部集数"
                        @click.stop
                      >
                        …
                      </button>
                    </a-popover>
                  </template>
                </div>
              </div>
            </template>
            <template v-else>
              <h3 class="works-lib-card__title">{{ work.title }}</h3>
              <div class="works-lib-card__row">
                <span class="works-lib-card__updated"
                  >最后更新 {{ formatDate(work.updatedAt) }}</span
                >
                <button
                  type="button"
                  class="works-lib-card__open"
                  aria-label="打开作品"
                  @click="openWork(work)"
                >
                  <ExportOutlined />
                </button>
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
import type { UserProjectRow, UserEpisodeRow } from '~/types/business-api'
import {
  userProjectDelete,
  userProjectDetail,
  userProjectList,
  userProjectPublish,
  userProjectSubmitAudit,
  userEpisodeList,
  userEpisodeCreate
} from '~/utils/businessApi'
import WorksLibraryAddCard from './WorksLibraryAddCard.vue'
import workCoverPlaceholderUrl from '~/assets/img/home/pic_bg.svg'
import { withCreateFlowFromQuery } from '~/utils/createFlowRoutes'

type WorkCategory = 'film' | 'series'

const props = withDefaults(
  defineProps<{
    embedded?: boolean
  }>(),
  { embedded: false }
)

const emit = defineEmits<{
  'switch-to-flow': []
  /** 独立「我的作品」页：打开创建作品弹窗；携带当前列表 Tab 以预选电影/剧集 */
  'open-create': [tab: WorkCategory]
}>()

type WorkListItem = Work & {
  category: WorkCategory
  episodeCount?: number
  rawStatus?: number
  isPublic?: string | null
}

const router = useRouter()
const route = useRoute()
const creationStore = useCreationStore()

const workType = ref<WorkCategory>('film')
const searchQuery = ref('')

const typeTabs: { label: string; value: WorkCategory }[] = [
  { label: '电影/短片', value: 'film' },
  { label: '电视剧集', value: 'series' }
]

const myWorks = ref<WorkListItem[]>([])

/** 主封面图 decode 完成后再显示，切换 Tab 新列表在 fetch 成功后会清空 */
const coverLoadedById = ref<Record<string, boolean>>({})

function onWorkCoverLoad(workId: string) {
  coverLoadedById.value = { ...coverLoadedById.value, [workId]: true }
}

function onWorkCoverImgError(ev: Event, workId: string) {
  const el = ev.target as HTMLImageElement | null
  if (!el || el.dataset.coverFallback === '1') {
    coverLoadedById.value = { ...coverLoadedById.value, [workId]: true }
    return
  }
  el.dataset.coverFallback = '1'
  el.src = workCoverPlaceholderUrl
  coverLoadedById.value = { ...coverLoadedById.value, [workId]: true }
}

/** 分集列表缓存（Popover / loadEpisodeRows 与卡片展示共用） */
const episodeRowsByProjectId = ref<Record<number, UserEpisodeRow[]>>({})
/** 卡片上展示的分集（按作品 id 缓存，列表刷新后由 prefetch 重填） */
const cardEpisodeRows = ref<Record<string, UserEpisodeRow[]>>({})

const activeEpisodePopoverId = ref<string | null>(null)
const episodePopoverLoadingId = ref<string | null>(null)

const addingEpisodeProjectId = ref<number | null>(null)

type DisplayPill =
  | { key: string; type: 'ep'; id: number; no: number }
  | { key: string; type: 'ellipsis' }

const EPISODE_STRIP_MAX = 5

function sortEpisodes(rows: UserEpisodeRow[]): UserEpisodeRow[] {
  return [...rows].sort((a, b) => (a.episodeNo ?? 0) - (b.episodeNo ?? 0))
}

function displayedEpisodePills(work: WorkListItem): DisplayPill[] {
  const rows = sortEpisodes(cardEpisodeRows.value[work.id] ?? [])
  if (rows.length === 0) return []
  if (rows.length <= EPISODE_STRIP_MAX) {
    return rows.map((e) => ({
      key: `e-${e.id}`,
      type: 'ep' as const,
      id: e.id,
      no: Number(e.episodeNo) || 0
    }))
  }
  const first = rows.slice(0, 4)
  const last = rows.slice(-2)
  return [
    ...first.map((e) => ({
      key: `e-${e.id}`,
      type: 'ep' as const,
      id: e.id,
      no: Number(e.episodeNo) || 0
    })),
    { key: 'ellipsis', type: 'ellipsis' as const },
    ...last.map((e) => ({
      key: `e-${e.id}`,
      type: 'ep' as const,
      id: e.id,
      no: Number(e.episodeNo) || 0
    }))
  ]
}

async function prefetchAllSeriesEpisodes() {
  const series = myWorks.value.filter((w) => w.category === 'series')
  await Promise.all(
    series.map(async (w) => {
      const pid = Number(w.id)
      if (!Number.isFinite(pid) || pid <= 0) return
      try {
        const sorted = sortEpisodes(await userEpisodeList({ projectId: pid }))
        episodeRowsByProjectId.value = { ...episodeRowsByProjectId.value, [pid]: sorted }
        cardEpisodeRows.value = { ...cardEpisodeRows.value, [w.id]: sorted }
      } catch {
        episodeRowsByProjectId.value = { ...episodeRowsByProjectId.value, [pid]: [] }
        cardEpisodeRows.value = { ...cardEpisodeRows.value, [w.id]: [] }
      }
    })
  )
}

async function loadEpisodeRows(projectId: number): Promise<UserEpisodeRow[]> {
  const cached = episodeRowsByProjectId.value[projectId]
  if (cached !== undefined) {
    return cached
  }
  const rows = await userEpisodeList({ projectId })
  const sorted = sortEpisodes(rows)
  episodeRowsByProjectId.value = { ...episodeRowsByProjectId.value, [projectId]: sorted }
  cardEpisodeRows.value = { ...cardEpisodeRows.value, [String(projectId)]: sorted }
  return sorted
}

async function navigateToEpisodeScript(projectId: number, episodeId: number) {
  creationStore.setCurrentProjectType('series')
  creationStore.setCurrentProjectContext({ projectId, episodeId })
  creationStore.setSeriesFlowEnteredStoryScript(true)
  await leaveEmbeddedLibraryView()
  await router.push({
    path: '/create/story-script',
    query: withCreateFlowFromQuery(
      {
        projectId: String(projectId),
        id: String(projectId),
        episodeId: String(episodeId)
      },
      props.embedded
    )
  })
}

function episodesForWork(work: WorkListItem): UserEpisodeRow[] {
  return sortEpisodes(cardEpisodeRows.value[work.id] ?? [])
}

function onEpisodePillClickById(work: WorkListItem, episodeId: number) {
  const pid = Number(work.id)
  if (!Number.isFinite(pid) || pid <= 0) return
  navigateToEpisodeScript(pid, episodeId)
}

async function onEpisodePopoverOpenChange(open: boolean, work: WorkListItem) {
  if (!open) {
    if (activeEpisodePopoverId.value === work.id) {
      activeEpisodePopoverId.value = null
    }
    if (episodePopoverLoadingId.value === work.id) {
      episodePopoverLoadingId.value = null
    }
    return
  }

  activeEpisodePopoverId.value = work.id
  const pid = Number(work.id)
  if (!Number.isFinite(pid) || pid <= 0) return

  if (cardEpisodeRows.value[work.id]?.length) return

  episodePopoverLoadingId.value = work.id
  try {
    await loadEpisodeRows(pid)
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '加载分集失败')
    activeEpisodePopoverId.value = null
  } finally {
    if (episodePopoverLoadingId.value === work.id) {
      episodePopoverLoadingId.value = null
    }
  }
}

function selectEpisodeFromPopover(work: WorkListItem, ep: UserEpisodeRow) {
  const pid = Number(work.id)
  if (!Number.isFinite(pid) || pid <= 0) return
  activeEpisodePopoverId.value = null
  navigateToEpisodeScript(pid, ep.id)
}

async function addEpisodeFromCard(work: WorkListItem) {
  const projectId = Number(work.id)
  if (!Number.isFinite(projectId) || projectId <= 0) {
    message.error('项目ID无效')
    return
  }
  addingEpisodeProjectId.value = projectId
  try {
    let rows: UserEpisodeRow[] = []
    try {
      rows = await userEpisodeList({ projectId })
    } catch {
      rows = []
    }
    const used = rows.map((r) => Number(r.episodeNo) || 0)
    const nextNo = used.length ? Math.max(...used) + 1 : 1
    await userEpisodeCreate({
      projectId,
      comicTitle: `第${nextNo}集`
    })
    message.success('已新增一集')
    await fetchWorkList()
  } catch (e: unknown) {
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
  creationStore.setWorkTitle(work.title || '未命名作品')
  creationStore.setCurrentProjectType('series')
  creationStore.setCurrentProjectContext({ projectId, episodeId: null })
  await leaveEmbeddedLibraryView()
  await router.push({
    path: '/create/series-episode-list',
    query: withCreateFlowFromQuery(
      { projectId: String(projectId), id: String(projectId) },
      props.embedded
    )
  })
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
    isPublic: row.isPublic ?? null
  }
}

function canSubmitProjectAudit(work: WorkListItem): boolean {
  if (work.category !== 'series') return false
  const st = work.rawStatus
  return st != null && st !== 3 && st !== 4
}

async function submitProjectAudit(work: WorkListItem) {
  const projectId = Number(work.id)
  if (!Number.isFinite(projectId) || projectId <= 0) return
  try {
    await userProjectSubmitAudit({ id: projectId })
    message.success('项目已提交审核')
    await fetchWorkList()
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '提交审核失败')
  }
}

async function publishWork(work: WorkListItem) {
  const projectId = Number(work.id)
  if (!Number.isFinite(projectId) || projectId <= 0) return
  Modal.confirm({
    title: '确认公开作品？',
    content: '公开后将在案例广场展示（电影类型）。',
    okText: '确认公开',
    cancelText: '取消',
    onOk: async () => {
      try {
        await userProjectPublish({ id: projectId })
        message.success('作品已公开')
        await fetchWorkList()
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '公开失败')
        throw e
      }
    }
  })
}

function mapAspectRatio(value?: string | null): '16:9' | '9:16' | '4:3' | '3:4' | '1:1' | '21:9' {
  const v = (value || '').trim()
  if (v === '16:9' || v === '9:16' || v === '4:3' || v === '3:4' || v === '1:1' || v === '21:9')
    return v
  return '16:9'
}

function mapModelStrategy(value?: string | null): 'economy' | 'performance' {
  if (value === 'performance') return 'performance'
  return 'economy'
}

function mapCreationMode(
  value?: string | null
): 'i2v' | 'multi' | 'pro' | 'auto_grid' {
  if (value === 'multi' || value === 'pro' || value === 'auto_grid') return value
  return 'i2v'
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
    episodeRowsByProjectId.value = {}
    cardEpisodeRows.value = {}
    myWorks.value = rows.map(mapProjectToWorkItem)
    if (workType.value === 'series') {
      await prefetchAllSeriesEpisodes()
    }
  } catch (_error) {
    if (fetchToken !== latestFetchToken) return
    coverLoadedById.value = {}
    episodeRowsByProjectId.value = {}
    cardEpisodeRows.value = {}
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

function formatCompactNumber(n: number): string {
  if (n >= 10000) {
    return `${(n / 10000).toFixed(1)}万`
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`
  }
  return String(n)
}

const statItems = computed(() => {
  const all = myWorks.value
  const total = all.length
  const views = all.reduce((s, w) => s + w.views, 0)
  const likes = all.reduce((s, w) => s + w.likes, 0)
  const inProgress = all.filter((w) => w.status === 'in-progress').length
  return [
    { key: 'total', label: '总作品', value: String(total) },
    { key: 'views', label: '总浏览', value: formatCompactNumber(views) },
    { key: 'likes', label: '获赞数', value: formatCompactNumber(likes) },
    { key: 'doing', label: '进行中', value: String(inProgress) }
  ]
})

const formatDate = (dateString: string) => {
  if (!dateString) return '--'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

onMounted(() => {
  fetchWorkList()
})

watch(workType, () => {
  fetchWorkList()
})

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    fetchWorkList()
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

/** 流程页内嵌作品库：先回到流程视图（由父级清除 panel=works），再路由跳转 */
async function leaveEmbeddedLibraryView() {
  if (!props.embedded) return
  emit('switch-to-flow')
  await nextTick()
}

async function openWork(work: Work) {
  const projectId = Number(work.id)
  if (!Number.isFinite(projectId) || projectId <= 0) {
    message.error('项目ID无效')
    return
  }
  try {
    const detail = await userProjectDetail(projectId)
    const currentSetting = creationStore.formData.globalSetting
    creationStore.setWorkTitle(detail.projectName || '未命名作品')
    creationStore.updateFormData({
      globalSetting: {
        ...currentSetting,
        title: detail.projectName || '',
        description: detail.projectDesc || '',
        aspectRatio: mapAspectRatio(detail.aspectRatio),
        scriptType: detail.scriptType === 'monologue' ? 'monologue' : 'plot',
        modelStrategy: mapModelStrategy(detail.defaultGenMode),
        creationMode: mapCreationMode(detail.defaultCreationMode)
      }
    })
    creationStore.setCurrentProjectType(detail.projectType)
    creationStore.setCurrentProjectContext({
      projectId,
      episodeId: detail.projectType === 'movie' ? 0 : null
    })
    if (detail.projectType === 'series') {
      creationStore.setSeriesFlowEnteredStoryScript(true)
    }
    const q = withCreateFlowFromQuery(
      { projectId: String(projectId), id: String(projectId) },
      props.embedded
    )
    if (props.embedded) {
      const nextQuery: Record<string, string> = {}
      for (const [key, value] of Object.entries(route.query)) {
        if (value == null) continue
        nextQuery[key] = Array.isArray(value) ? String(value[0] ?? '') : String(value)
      }
      Object.assign(nextQuery, q)
      delete nextQuery.panel
      // 保持当前步骤路由，仅更新作品 query；避免跳转 /create 卸载流程壳层导致内嵌作品库无法切回流程
      await router.replace({ path: route.path, query: nextQuery })
      emit('switch-to-flow')
      await nextTick()
      return
    }
    await router.push({ path: '/create', query: q })
  } catch (_error) {
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
/* 我的作品列表：封面区固定高度带，避免远程图未返回前整块塌陷成纯黑 */
.works-lib-card__cover {
  position: relative;
  flex: 0 0 auto;
  min-height: 166px;
  max-height: 180px;
  overflow: hidden;
}

/* 底层占位图：始终铺满封面区 */
.works-lib-card__cover-underlay {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

/* 主封面：加载完成前透明，露出底层 pic_bg */
.works-lib-card__cover-img {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  min-height: 166px;
  max-height: 180px;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.works-lib-card__cover-img.is-loaded {
  opacity: 1;
}

/* 悬停缩放只作用主图，避免底层占位一起变形（与全局 .works-lib-card__cover img 区分） */
.works-lib-card:hover .works-lib-card__cover-underlay {
  transform: none;
}

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
  grid-auto-rows: minmax(236px, auto);
}

/* 剧集卡片底部：占满卡片宽度 */
.works-lib-card--series .works-lib-card__body {
  display: flex;
  flex-direction: column;
  padding: 0 12px 0;
  box-sizing: border-box;
  height: 90px;
}

.works-lib-card__episodes--series {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  gap:6px;
  min-height: 100px;
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
}

/* 集数按钮独占一行并拉满宽度：均分栅格 */
.works-lib-card__ep-pills-row {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(auto-fill, minmax(30px, 1fr));
  gap: 8px;
  min-height: 30px;
  align-items: stretch;
  box-sizing: border-box;
}

.works-lib-card__ep-pills-row .works-lib-card__ep-num,
.works-lib-card__ep-pills-row .works-lib-card__ep-ellipsis {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.works-lib-card__ep-ellipsis {
  min-width: 32px;
  height: 32px;
  padding: 0 6px;
  border-radius: 8px;
  border: none;
  background: #202434;
  color: var(--home-white);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}

.works-lib-card__ep-ellipsis:hover {
  border-color: rgba(74, 231, 253, 0.45);
  color: var(--home-cyan, #4ae7fd);
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

:deep(.works-lib-card__cover-btn--text) {
  width: auto;
  min-width: 52px;
  height: 28px;
  padding: 0 10px;
  border-radius: 14px;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}
</style>

<style>
/* Popover teleport 到 body，不用 scoped */
.works-lib-ep-popover .ant-popover-inner {
  background: rgba(34, 44, 64, 0.985) !important;
  border: 1px solid rgba(74, 231, 253, 0.09) !important;
  border-radius: 8px !important;
  box-shadow: 0 24px 56px rgba(8, 12, 24, 0.45) !important;
  padding: 12px !important;
}

.works-lib-ep-popover .ant-popover-arrow::before {
  background: rgba(34, 44, 64, 0.985) !important;
}

.works-lib-ep-popover .works-lib-ep-popover__loading,
.works-lib-ep-popover .works-lib-ep-popover__empty {
  min-width: 120px;
  padding: 12px 8px;
  text-align: center;
  color: #8e97a5;
  font-size: 13px;
}

.works-lib-ep-popover .works-lib-ep-popover__grid {
  display: grid;
  grid-template-columns: repeat(5, 32px);
  gap: 8px;
  max-width: 200px;
  max-height: 200px;
  overflow-y: auto;
}

.works-lib-ep-popover .works-lib-ep-popover__btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 8px;
  border: none;
  background: #202434;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
}

.works-lib-ep-popover .works-lib-ep-popover__btn:hover {
  color: var(--home-cyan);
}
</style>
