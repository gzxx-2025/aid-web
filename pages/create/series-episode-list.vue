<template>
  <div class="series-ep-list">
    <div class="series-ep-list__toolbar">
      <!-- 与 EditStoryboardImageModal 右侧 config-tabs--three / config-tab 一致 -->
      <div class="series-ep-list__segment-wrap">
        <div class="series-ep-list__segment-tabs" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            role="tab"
            class="series-ep-list__segment-tab"
            :class="{ active: activeTab === tab.key }"
            :aria-selected="activeTab === tab.key"
            @click="onTabClick(tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
      <button
        v-if="activeTab === 'episodes'"
        type="button"
        class="series-ep-list__add"
        :disabled="adding"
        @click="onAddEpisode"
      >
        <PlusOutlined />
        新增一集
      </button>
    </div>

    <div v-if="activeTab === 'episodes'" class="series-ep-list__body">
      <div v-if="loading" class="series-ep-list__loading">加载中…</div>
      <div v-else-if="sortedEpisodes.length === 0" class="series-ep-list__empty">
        暂无分集，点击「新增一集」开始
      </div>
      <div v-else class="series-ep-list__table" role="table" aria-label="剧集列表">
        <div class="series-ep-list__thead" role="row">
          <span class="series-ep-list__th-num" aria-hidden="true" />
          <span role="columnheader" class="series-ep-list__th-col">集数</span>
          <span role="columnheader" class="series-ep-list__th-col">创建时间</span>
          <span role="columnheader" class="series-ep-list__th-col">操作</span>
        </div>
        <div v-for="ep in sortedEpisodes" :key="ep.id" class="series-ep-list__row" role="row">
          <div class="series-ep-list__cell series-ep-list__cell--num" role="cell">
            <span class="series-ep-list__num">{{ ep.episodeNo ?? '—' }}</span>
          </div>
          <div class="series-ep-list__cell series-ep-list__cell--ep" role="cell">
            <span class="series-ep-list__ep-inner">
              <img src="/assets/img/icon/tv.svg" class="series-ep-list__doc-ico" alt="" />
              <span class="series-ep-list__ep-title">{{
                ep.comicTitle || `第${ep.episodeNo ?? ''}集`
              }}</span>
            </span>
          </div>
          <div class="series-ep-list__cell series-ep-list__cell--time" role="cell">
            {{ formatDateTime(ep.createTime) }}
          </div>
          <div class="series-ep-list__cell series-ep-list__cell--actions" role="cell">
            <button
              type="button"
              class="series-ep-list__btn series-ep-list__btn--primary"
              :disabled="generatingEpisodeId !== null || deletingEpisodeId !== null"
              @click="generateEpisode(ep)"
            >
              {{ generatingEpisodeId === ep.id ? '进入中…' : '生成剧集' }}
            </button>
            <button
              type="button"
              class="series-ep-list__btn series-ep-list__btn--ghost"
              :disabled="deletingEpisodeId !== null || generatingEpisodeId !== null"
              @click="deleteEpisode(ep)"
            >
              {{ deletingEpisodeId === ep.id ? '删除中…' : '删除剧集' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="activeTab === 'characters' || activeTab === 'props' || activeTab === 'scenes'"
      class="series-ep-list__asset-body"
    >
      <div v-if="projectAssetsLoading" class="series-ep-list__loading">加载资产中…</div>
      <div
        v-else-if="sortedProjectAssets.length > 0"
        class="series-ep-list__asset-grid-wrap assets-library-figma"
      >
        <div class="works-lib-grid series-ep-list__works-grid">
          <SeriesProjectAssetCard
            v-for="row in sortedProjectAssets"
            :key="row.id"
            :title="row.assetName || '未命名'"
            :cover-image="assetCoverUrl(row)"
            :date-label="row.createTime || row.updateTime || ''"
            @delete="onDeleteProjectAsset(row)"
            @edit="openSceneCharacterForAssets"
          />
        </div>
      </div>
      <div v-else class="series-ep-list__empty">{{ emptyAssetTips }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { useCreationStore } from '~/stores/creation'
import {
  rpsRowToUserAssetRow,
  userAssetRpsDelete,
  userAssetRpsList,
  userEpisodeCreate,
  userEpisodeDelete,
  userEpisodeList,
  userScriptDetailByProject
} from '~/utils/businessApi'
import type { UserAssetApiType, UserAssetRow, UserEpisodeRow } from '~/types/business-api'
import SeriesProjectAssetCard from '~/components/create/SeriesProjectAssetCard.vue'
import { emptyImageIconUrl as assetCoverPlaceholderUrl } from '~/utils/emptyImageIcon'
import { isProjectPublicLockError, projectPublicLockUserHint } from '~/utils/projectAudit'
import {
  htmlPlainTextLength,
  resolveStoryScriptEditorHtmlAfterApiLoad,
  storyScriptOriginalTextForApi
} from '~/utils/htmlPlain'
definePageMeta({ layout: 'create' })

const router = useRouter()
const route = useRoute()
const creationStore = useCreationStore()

const tabs = [
  { key: 'episodes' as const, label: '剧集管理' },
  { key: 'characters' as const, label: '角色' },
  { key: 'props' as const, label: '道具' },
  { key: 'scenes' as const, label: '场景' }
]

const activeTab = ref<(typeof tabs)[number]['key']>('episodes')
const loading = ref(true)
const adding = ref(false)
const generatingEpisodeId = ref<number | null>(null)
const deletingEpisodeId = ref<number | null>(null)
const episodes = ref<UserEpisodeRow[]>([])

const sortedEpisodes = computed(() =>
  [...episodes.value].sort((a, b) => (a.episodeNo ?? 0) - (b.episodeNo ?? 0))
)

const emptyAssetTips = computed(() => {
  if (activeTab.value === 'characters') return '暂无角色'
  if (activeTab.value === 'props') return '暂无道具'
  return '暂无场景'
})

/** 无封面 / 副图时与「我的作品」卡片一致的本地占位（不依赖外网生成图） */
const PLACEHOLDER_ASSET_COVER = assetCoverPlaceholderUrl

const tabKeyToApiType: Record<'characters' | 'props' | 'scenes', UserAssetApiType> = {
  characters: 'character',
  props: 'prop',
  scenes: 'scene'
}

const projectAssets = ref<UserAssetRow[]>([])
const projectAssetsLoading = ref(false)
let projectAssetsFetchToken = 0

function sortAssetRows(rows: UserAssetRow[]): UserAssetRow[] {
  return [...rows].sort((a, b) => {
    const ta = new Date(a.updateTime || a.createTime || 0).getTime()
    const tb = new Date(b.updateTime || b.createTime || 0).getTime()
    return tb - ta
  })
}

const sortedProjectAssets = computed(() => sortAssetRows(projectAssets.value))

/** 角色/道具/场景：POST /api/user/asset/rps/list（projectId + episodeId + assetType） */
async function loadProjectAssets() {
  const tab = activeTab.value
  if (tab !== 'characters' && tab !== 'props' && tab !== 'scenes') return
  const pid = projectIdFromRoute()
  if (!pid) {
    projectAssets.value = []
    return
  }
  const fetchToken = ++projectAssetsFetchToken
  projectAssetsLoading.value = true
  try {
    const ep = resolveEpisodeIdForAssets()
    const { rows } = await userAssetRpsList({
      projectId: pid,
      ...(ep != null && ep > 0 ? { episodeId: ep } : {}),
      assetType: tabKeyToApiType[tab]
    })
    if (fetchToken !== projectAssetsFetchToken) return
    projectAssets.value = rows.map(rpsRowToUserAssetRow)
  } catch (e: unknown) {
    if (fetchToken !== projectAssetsFetchToken) return
    projectAssets.value = []
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '加载资产失败')
  } finally {
    if (fetchToken === projectAssetsFetchToken) projectAssetsLoading.value = false
  }
}

function assetCoverUrl(row: UserAssetRow): string {
  let thumb = row.refImageUrl?.trim() || ''
  if (!thumb && row.extraImages) {
    const first = row.extraImages
      .split(';')
      .map((s) => s.trim())
      .find(Boolean)
    thumb = first || ''
  }
  return thumb || PLACEHOLDER_ASSET_COVER
}

function resolveEpisodeIdForAssets(): number | null {
  const fromStore = creationStore.currentEpisodeId
  if (fromStore != null && fromStore > 0) return fromStore
  const fromRoute = Number(route.query.episodeId)
  if (Number.isFinite(fromRoute) && fromRoute > 0) return fromRoute
  const first = sortedEpisodes.value[0]?.id
  return first ?? null
}

function openSceneCharacterForAssets() {
  const pid = projectIdFromRoute()
  const eid = resolveEpisodeIdForAssets()
  if (!pid || !eid) {
    message.warning('请先新增至少一集后再编辑资产')
    return
  }
  creationStore.setCurrentProjectContext({ projectId: pid, episodeId: eid })
  creationStore.setSeriesFlowEnteredStoryScript(true)
  router.push({ path: '/create/scene-character', query: buildQuery(eid) })
}

function onDeleteProjectAsset(row: UserAssetRow) {
  Modal.confirm({
    title: '删除资产',
    content: `确认删除「${row.assetName || '未命名'}」吗？`,
    okText: '删除',
    cancelText: '取消',
    okType: 'danger',
    async onOk() {
      try {
        await userAssetRpsDelete({ id: row.id })
        message.success('删除成功')
        await loadProjectAssets()
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '删除失败')
      }
    }
  })
}

function projectIdFromRoute(): number | null {
  const routePid = Number(route.query.projectId ?? route.query.id ?? route.query.workId)
  const pid =
    creationStore.currentProjectId ?? (Number.isFinite(routePid) && routePid > 0 ? routePid : null)
  return pid
}

function buildQuery(episodeId: number) {
  const q: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query)) {
    if (v === undefined || v === null) continue
    q[k] = Array.isArray(v) ? String(v[0] ?? '') : String(v)
  }
  const pid = projectIdFromRoute()
  if (pid) {
    q.projectId = String(pid)
    q.id = String(pid)
  }
  q.episodeId = String(episodeId)
  return q
}

/** 已加载/加载中的 projectId：watch 因 store 水合后置触发时，同项目不重复拉列表 */
let episodesLoadedProjectId: number | null = null

async function loadEpisodes(opts?: { force?: boolean }) {
  const pid = projectIdFromRoute()
  if (!pid) {
    episodesLoadedProjectId = null
    episodes.value = []
    creationStore.setSeriesEpisodeListTotal(0)
    loading.value = false
    return
  }
  if (!opts?.force && episodesLoadedProjectId === pid) return
  episodesLoadedProjectId = pid
  loading.value = true
  try {
    const rows = await userEpisodeList({ projectId: pid })
    episodes.value = rows
    creationStore.setSeriesEpisodeListTotal(rows.length)
  } catch (e: unknown) {
    /** 失败时清除已加载标记，允许下一次触发重试 */
    episodesLoadedProjectId = null
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '加载分集失败')
    episodes.value = []
    creationStore.setSeriesEpisodeListTotal(0)
  } finally {
    loading.value = false
  }
}

function formatDateTime(raw?: string | null): string {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}/${m}/${day} ${h}:${min}`
}

function onTabClick(key: (typeof tabs)[number]['key']) {
  activeTab.value = key
  if (key === 'characters' || key === 'props' || key === 'scenes') {
    const pid = projectIdFromRoute()
    const eid = resolveEpisodeIdForAssets()
    if (pid && eid) {
      creationStore.setCurrentProjectContext({ projectId: pid, episodeId: eid })
    }
    void loadProjectAssets()
  }
}

async function onAddEpisode() {
  const pid = projectIdFromRoute()
  if (!pid) {
    message.warning('缺少项目信息')
    return
  }
  adding.value = true
  try {
    const nextNo =
      sortedEpisodes.value.length > 0
        ? Math.max(...sortedEpisodes.value.map((e) => e.episodeNo ?? 0)) + 1
        : 1
    await userEpisodeCreate({
      projectId: pid,
      comicTitle: `第${nextNo}集`
    })
    message.success('已新增一集')
    await loadEpisodes({ force: true })
  } catch (e: unknown) {
    if (isProjectPublicLockError(e)) {
      message.error(projectPublicLockUserHint())
      return
    }
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '新增失败')
  } finally {
    adding.value = false
  }
}

function deleteEpisode(ep: UserEpisodeRow) {
  if (deletingEpisodeId.value !== null || generatingEpisodeId.value !== null) return
  const title = ep.comicTitle || `第${ep.episodeNo ?? ''}集`
  Modal.confirm({
    title: '删除剧集',
    content: `确认删除「${title}」吗？删除后不可恢复。`,
    okText: '删除',
    cancelText: '取消',
    okType: 'danger',
    async onOk() {
      deletingEpisodeId.value = ep.id
      try {
        await userEpisodeDelete({ id: ep.id })
        message.success('删除成功')
        if (creationStore.currentEpisodeId === ep.id) {
          creationStore.setCurrentProjectContext({ episodeId: null })
        }
        await loadEpisodes({ force: true })
      } catch (e: unknown) {
        if (isProjectPublicLockError(e)) {
          message.error(projectPublicLockUserHint())
          return
        }
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '删除失败')
        throw e
      } finally {
        deletingEpisodeId.value = null
      }
    }
  })
}

async function generateEpisode(ep: UserEpisodeRow) {
  if (generatingEpisodeId.value !== null) return
  const projectId = projectIdFromRoute()
  if (!projectId) {
    message.warning('缺少项目信息')
    return
  }

  generatingEpisodeId.value = ep.id
  try {
    const script = await userScriptDetailByProject({ projectId, episodeId: ep.id })
    const rawScript = String(script?.simplifiedText || script?.originalText || '').trim()
    const hasScript = htmlPlainTextLength(rawScript) > 0

    creationStore.setCurrentProjectContext({ projectId, episodeId: ep.id })
    creationStore.setSeriesFlowEnteredStoryScript(true)
    creationStore.updateFormData({
      storyScript: {
        content: hasScript ? resolveStoryScriptEditorHtmlAfterApiLoad(rawScript, '') : ''
      }
    })
    creationStore.setScriptServerHtmlBaseline(
      storyScriptOriginalTextForApi(creationStore.formData.storyScript.content || '')
    )

    try {
      await router.push({
        path: hasScript ? '/create/scene-character' : '/create/story-script',
        query: {
          ...buildQuery(ep.id),
          stepInitAdvance: '1',
          ...(hasScript ? { stepInitTarget: 'scene-character' } : {})
        }
      })
    } catch (navErr: unknown) {
      // 快速连点不同剧集时，并发导航可能被 Vue Router / Suspense 打断
      if (import.meta.dev) {
        console.warn('[series-episode-list] generateEpisode navigation skipped', navErr)
      }
    }
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '读取剧本失败，请稍后重试')
  } finally {
    generatingEpisodeId.value = null
  }
}

onMounted(() => {
  void loadEpisodes()
})

watch(
  () => [route.query.projectId, route.query.id, route.query.workId, creationStore.currentProjectId],
  () => {
    void loadEpisodes()
    if (activeTab.value === 'characters' || activeTab.value === 'props' || activeTab.value === 'scenes') {
      void loadProjectAssets()
    }
  }
)

onUnmounted(() => {
  creationStore.setSeriesEpisodeListTotal(null)
})
</script>

<style scoped lang="scss">
.series-ep-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 4px 0 16px;
  box-sizing: border-box;
  background: #111621;
  border-radius: 8px;
}

.series-ep-list__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  margin-bottom: 10px;
  flex-shrink: 0;
}

/* 对齐 components/steps/EditStoryboardImageModal.vue — .config-tabs--three / .config-tab */
.series-ep-list__segment-wrap {
  min-width: 336px;
}

.series-ep-list__segment-tabs {
  display: flex;
  width: 100%;
  justify-content: center;
  gap: 4px;
  border-radius: 8px;
  background: rgba(35, 67, 74, 1);
  flex-shrink: 0;
}

.series-ep-list__segment-tab {
  flex: 1;
  min-width: 0;
  height: 32px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgba(225, 239, 255, 0.7);
  font-size: 14px;
  line-height: 1.2;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 4px;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}

.series-ep-list__segment-tab:hover:not(.active) {
  color: rgba(225, 239, 255, 0.92);
}

.series-ep-list__segment-tab.active {
  color: #0b1522 !important;
  font-weight: 600;
  background: rgba(74, 231, 253, 1);
}

.series-ep-list__add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 8px;
  border-radius: 8px;
  border: 1px solid rgba(74, 231, 253, 0.45);
  background: transparent;
  color: #4ae7fd;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.series-ep-list__add:hover:not(:disabled) {
  background: rgba(74, 231, 253, 0.1);
  border-color: rgba(74, 231, 253, 0.65);
}

.series-ep-list__add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.series-ep-list__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.series-ep-list__loading,
.series-ep-list__empty {
  padding: 3rem 1rem;
  text-align: center;
  color: #8e97a5;
  font-size: 14px;
}

.series-ep-list__table {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.series-ep-list__thead {
  display: grid;
  grid-template-columns: 52px minmax(200px, 0.4fr) minmax(140px, 0.9fr) minmax(220px, 0.4fr);
  gap: 12px;
  align-items: center;
  padding: 10px 16px 8px;
  border: 1px solid rgba(74, 231, 253, 0.3);
  border-radius: 8px 8px 0 0;
  font-size: 13px;
  font-weight: 500;
  color: #8e97a5;
}

.series-ep-list__th-num {
  min-width: 0;
}

.series-ep-list__th-col {
  text-align: center;
}

.series-ep-list__row {
  display: grid;
  grid-template-columns: 52px minmax(200px, 0.4fr) minmax(140px, 0.9fr) minmax(220px, 0.4fr);
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  border-radius: 8px;
  background: rgba(32, 36, 52, 1);
  margin-bottom: 4px;
  &:nth-child(odd) {
    background: rgba(32, 36, 52, 0.5);
  }
}

.series-ep-list__cell--num {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.series-ep-list__cell--ep {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.series-ep-list__ep-inner {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  max-width: 100%;
}

.series-ep-list__num {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, rgba(14, 89, 250, 0.95), rgba(0, 171, 216, 0.9));
}

.series-ep-list__doc-ico {
  width: 24px;
  height: 24px;
}

.series-ep-list__ep-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.series-ep-list__cell--time {
  text-align: center;
  font-size: 13px;
}

.series-ep-list__cell--actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.series-ep-list__btn {
  height: 32px;
  padding: 0 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    opacity 0.15s ease,
    background 0.15s ease,
    background-image 0.15s ease,
    color 0.15s ease;
}

/* 渐变描边与圆角：用双层 background + clip，避免 border-image 不吃 border-radius */
.series-ep-list__btn--ghost {
  border: 1px solid transparent;
  background-image:
    linear-gradient(#151a26, #151a26),
    linear-gradient(270deg, rgba(14, 89, 250, 0.5) 0%, rgba(0, 171, 216, 0.5) 100%);
  background-origin: border-box;
  background-clip: padding-box, border-box;
  color: rgba(230, 237, 243, 0.92);
}

.series-ep-list__btn--ghost:hover:not(:disabled) {
  background-image:
    linear-gradient(#151a26, #151a26),
    linear-gradient(270deg, rgba(14, 89, 250, 0.72) 0%, rgba(0, 171, 216, 0.72) 100%);
  color: #fff;
}

.series-ep-list__btn--primary {
  background: linear-gradient(270deg, rgba(14, 89, 250, 0.5) 0%, rgba(0, 171, 216, 0.5) 100%);
  color: #fff;
  border: none;
}

.series-ep-list__btn--primary:hover:not(:disabled) {
  opacity: 0.92;
}

.series-ep-list__btn:disabled {
  cursor: wait;
  opacity: 0.62;
}

.series-ep-list__asset-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.series-ep-list__asset-grid-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

/* 本页资产卡片：点击预览；竖版封面铺满宽度，减少两侧留白 */
/* 竖版封面 + 底部信息区按内容高度收紧（不再固定 68px） */
.series-ep-list__asset-grid-wrap.assets-library-figma {
  --works-lib-cover-ratio: 3 / 4;
  --works-lib-body-h: auto;
}

.series-ep-list__asset-grid-wrap.assets-library-figma .works-lib-card {
  cursor: zoom-in;
}

.series-ep-list__asset-grid-wrap.assets-library-figma :deep(.works-lib-card__body) {
  height: auto;
  min-height: 0;
  padding: 10px 12px 12px;
}

.series-ep-list__works-grid {
  /* 卡片略加宽，竖版封面更高更完整 */
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.series-ep-list__asset-grid-wrap.assets-library-figma :deep(.works-lib-card__cover) {
  height: auto;
  aspect-ratio: 3 / 4;
  max-height: none;
  background: #0a0f14;
}

.series-ep-list__asset-grid-wrap.assets-library-figma :deep(.works-lib-card__cover-img),
.series-ep-list__asset-grid-wrap.assets-library-figma :deep(.works-lib-card__cover > img:not(.card-cover-placeholder-icon)) {
  width: 100%;
  height: 100%;
  min-height: 0;
  object-fit: cover;
  object-position: center top;
}

.series-ep-list__placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8e97a5;
  font-size: 14px;
}

@media (max-width: 900px) {
  .series-ep-list__thead,
  .series-ep-list__row {
    grid-template-columns: 1fr;
  }

  .series-ep-list__th-num {
    display: none;
  }

  .series-ep-list__cell--num {
    justify-content: flex-start;
  }

  .series-ep-list__cell--ep,
  .series-ep-list__cell--time,
  .series-ep-list__cell--actions {
    justify-content: flex-start;
  }

  .series-ep-list__cell--time {
    text-align: left;
  }

  .series-ep-list__th-col {
    text-align: left;
  }
}
</style>
