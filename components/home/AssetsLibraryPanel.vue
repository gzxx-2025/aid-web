<template>
  <div class="assets-page home-new-sub-page assets-library-figma">
    <div class="page-content assets-library-figma__inner">
      <header class="works-lib-header">
        <h1 class="works-lib-header__title">资产库</h1>
      </header>
      <section class="works-lib-stats" aria-label="资产统计">
        <div v-for="item in statItems" :key="item.key" class="works-lib-stat-card">
          <span class="works-lib-stat-card__label">{{ item.label }}</span>
          <span class="works-lib-stat-card__value">{{ item.value }}</span>
        </div>
      </section>

      <section class="works-lib-toolbar assets-lib-toolbar" aria-label="分类与搜索">
        <div class="works-lib-type-tabs" role="tablist">
          <button
            v-for="tab in assetTabs"
            :key="tab.value"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.value"
            :class="[
              'works-lib-type-tabs__btn',
              'assets-lib-tab',
              { 'is-active': activeTab === tab.value }
            ]"
            @click="activeTab = tab.value"
            @mouseenter="hoveredAssetTab = tab.value"
            @mouseleave="hoveredAssetTab = null"
          >
            <img
              class="assets-lib-tab__ico"
              :src="
                activeTab === tab.value || hoveredAssetTab === tab.value ? tab.iconSel : tab.iconNor
              "
              alt=""
              width="20"
              height="20"
              draggable="false"
            />
            {{ tab.label }}
          </button>
        </div>
        <div class="works-lib-search">
          <SearchOutlined class="works-lib-search__ico" />
          <input
            v-model="searchQuery"
            type="search"
            class="works-lib-search__input"
            placeholder="搜索资产..."
            autocomplete="off"
          />
        </div>
      </section>

      <div class="works-lib-grid">
        <WorksLibraryAddCard
          v-if="!assetsEmpty"
          label="新增资产"
          hint="创建用户自定义参考资产"
          @click="openCreateModal"
        />
        <article
          v-for="asset in myAssets"
          :key="asset.id"
          class="works-lib-card"
          @click="openAssetPreview(asset)"
        >
          <div
            class="works-lib-card__cover"
            :class="{ 'works-lib-card__cover--placeholder': !asset.hasCover }"
          >
            <ShimmerImage
              v-if="asset.hasCover"
              :src="asset.thumbnail"
              :alt="asset.name"
              img-class="works-lib-card__cover-img"
              wrapper-class="works-lib-card__cover-shimmer"
              object-fit="cover"
              reveal-direction="fade"
              :min-shimmer-ms="280"
            />
            <img
              v-else
              class="card-cover-placeholder-icon"
              :src="emptyImageIconUrl"
              alt=""
              width="88"
              height="88"
              draggable="false"
            />
            <div class="works-lib-card__cover-actions">
              <button
                v-if="isUserOwnedAsset(asset)"
                type="button"
                class="works-lib-card__cover-btn"
                aria-label="删除"
                @click.stop="removeAsset(asset)"
              >
                <img :src="deleteWhite" alt="" />
              </button>
              <button
                v-if="isUserOwnedAsset(asset)"
                type="button"
                class="works-lib-card__cover-btn"
                aria-label="编辑"
                @click.stop="openEditModal(asset)"
              >
                <img :src="editWhite" alt="" />
              </button>
            </div>
          </div>
          <div class="works-lib-card__body">
            <h3 class="works-lib-card__title">
              <span>{{ asset.name }}</span>
            </h3>
            <div class="works-lib-card__row works-lib-card__row--asset">
              <span class="works-lib-card__from">类型: {{ asset.typeName }}</span>
              <div class="works-lib-card__row-trailing">
                <span class="works-lib-card__updated">{{ formatDate(asset.createdAt) }}</span>
              </div>
            </div>
          </div>
        </article>

        <div v-if="assetsEmpty" class="works-lib-empty works-lib-empty--full">
          <img class="works-lib-empty__icon-img empty-image-icon empty-image-icon--lg" :src="assetsEmptyIconUrl" alt="" />
          <h3 class="works-lib-empty__title">暂无资产</h3>
          <button type="button" class="works-lib-empty__btn" @click="openCreateModal">
            <div class="text-gradient">新增资产</div>
          </button>
        </div>
      </div>
    </div>

    <a-modal
      v-model:open="assetFormOpen"
      :footer="null"
      width="50%"
      wrap-class-name="create-flow-modal"
      @cancel="closeAssetFormModal"
    >
      <template #title>
        <ModalTitleWatermark :title="assetFormMode === 'create' ? '新增资产' : '编辑资产'" watermark="ASSET" />
      </template>

      <div class="asset-form-modal">
        <a-form layout="vertical" class="asset-form-modal__grid">
          <a-form-item class="asset-form-item asset-form-item--full asset-form-item--upload">
            <div class="style-cover-upload style-cover-upload--header">
              <input
                ref="assetCoverInputRef"
                type="file"
                accept="image/*"
                hidden
                @change="onAssetCoverFileChange"
              />
              <button
                type="button"
                class="style-cover-upload__box"
                :class="{ 'style-cover-upload__box--filled': !!assetForm.imageUrl }"
                :disabled="assetCoverUploading"
                @click="triggerAssetCoverUpload"
              >
                <ShimmerImage
                  v-if="assetForm.imageUrl"
                  :src="assetForm.imageUrl"
                  alt="资产图片"
                  wrapper-class="style-cover-upload__preview"
                  img-class="style-cover-upload__img"
                  object-fit="cover"
                  reveal-direction="fade"
                  :min-shimmer-ms="280"
                />
                <span v-else-if="assetCoverUploading" class="style-cover-upload__hint">上传中…</span>
                <span v-else class="style-cover-upload__placeholder">
                  <PlusOutlined class="style-cover-upload__icon" />
                  <span>上传图片</span>
                </span>
              </button>
              <div class="style-cover-upload__meta">
                <p class="style-cover-upload__tip">支持 JPG、PNG，最大 10MB</p>
                <a
                  v-if="assetForm.imageUrl"
                  class="style-cover-upload__remove"
                  @click.prevent="clearAssetCover"
                >
                  移除图片
                </a>
              </div>
            </div>
          </a-form-item>
          <a-form-item label="资产类型" required class="asset-form-item asset-form-item--half">
            <a-select
              v-model:value="assetForm.assetType"
              :disabled="assetFormMode === 'edit'"
              placeholder="类型"
              :options="assetTypeSelectOptions"
            />
          </a-form-item>
          <a-form-item label="资产名称" required class="asset-form-item asset-form-item--half">
            <a-input v-model:value="assetForm.assetName" maxlength="100" placeholder="请输入" />
          </a-form-item>
          <a-form-item label="特征描述" class="asset-form-item asset-form-item--full">
            <a-textarea
              v-model:value="assetForm.personalityDesc"
              :rows="4"
              maxlength="500"
              placeholder="请输入"
            />
          </a-form-item>
          <a-form-item label="提示词" class="asset-form-item asset-form-item--full">
            <a-textarea
              v-model:value="assetForm.promptText"
              :rows="4"
              maxlength="500"
              placeholder="请输入"
            />
          </a-form-item>
          <a-form-item label="备注" class="asset-form-item asset-form-item--full">
            <a-input v-model:value="assetForm.remark" maxlength="500" placeholder="请输入" />
          </a-form-item>
        </a-form>

        <div class="asset-form-modal__footer">
          <a-button @click="closeAssetFormModal">
            <div class="text-gradient">取消</div>
          </a-button>
          <a-button type="primary" :loading="assetSubmitting" @click="submitAssetForm">
            {{ assetFormMode === 'create' ? '确定' : '保存修改' }}
          </a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { message, Modal } from 'ant-design-vue'
import type { MergedAssetVO, UserAssetCustomTypeItem } from '~/types/business-api'
import {
  userAssetCustomCreate,
  userAssetCustomDelete,
  userAssetCustomDetail,
  userAssetMergedPage,
  userAssetCustomTypeList,
  userAssetCustomUpdate
} from '~/utils/businessApi'
import deleteWhite from '~/assets/img/home/delete-white.svg'
import editWhite from '~/assets/img/home/edit-white.svg'
import sceneNor from '~/assets/img/icon/scene-nor.svg'
import sceneSel from '~/assets/img/icon/scene-sel.svg'
import characterNor from '~/assets/img/icon/character-nor.svg'
import characterSel from '~/assets/img/icon/prop-sel.svg'
import propNor from '~/assets/img/icon/prop-nor.svg'
import propSel from '~/assets/img/icon/character-sel.svg'
import recordingNor from '~/assets/img/icon/recording-nor.svg'
import recordingSel from '~/assets/img/icon/recording-sel.svg'
import { emptyImageIconUrl } from '~/utils/emptyImageIcon'
import assetsEmptyIconUrl from '~/assets/img/icon/assest-empty.svg'
// 全部图标
import assetAllNor from '~/assets/img/icon/assets-all-nor.svg'
import assetAllSel from '~/assets/img/icon/assets-all-sel.svg'
// 文件
import fileNor from '~/assets/img/icon/file-nor.svg'
import fileSel from '~/assets/img/icon/flie-white-sel.svg'
// 参数
import parameterNor from '~/assets/img/icon/parameters-nor.svg'
import parameterSel from '~/assets/img/icon/parameters-sel.svg'
//姿势
import postureNor from '~/assets/img/icon/posture-nor.svg'
import postureSel from '~/assets/img/icon/posture-sel.svg'
//特效
import effectNor from '~/assets/img/icon/effects-nor.svg'
import effectSel from '~/assets/img/icon/effects-sel.svg'
//风格
import styleNor from '~/assets/img/icon/style-nor.svg'
import styleSel from '~/assets/img/icon/style-sel.svg'
// 情绪
import emotionNor from '~/assets/img/icon/emotion-nor.svg'
import emotionSel from '~/assets/img/icon/emotion-sel.svg'
// 表情
import emojiNor from '~/assets/img/icon/emoj-nor.svg'
import emojiSel from '~/assets/img/icon/emoj-sel.svg'
import WorksLibraryAddCard from '~/components/home/WorksLibraryAddCard.vue'
import ModalTitleWatermark from '~/components/ModalTitleWatermark.vue'
import ShimmerImage from '~/components/common/ShimmerImage.vue'
import { uploadImageToOssWithToast } from '~/utils/ossUpload'
import { isMergedAssetUserOwned } from '~/utils/mergedAssetSource'
import { openImagePreviewModal } from '~/utils/openImagePreviewModal'

type AssetItem = {
  id: string
  name: string
  type: string
  typeName: string
  thumbnail: string
  hasCover: boolean
  createdAt: string
  sourceFlag: string
  raw: MergedAssetVO
}

const activeTab = ref<string>('all')
const hoveredAssetTab = ref<string | null>(null)
const searchQuery = ref('')

const assetFormOpen = ref(false)
const assetFormMode = ref<'create' | 'edit'>('create')
const editingAssetId = ref<number | null>(null)
const assetSubmitting = ref(false)
const assetCoverUploading = ref(false)
const assetCoverInputRef = ref<HTMLInputElement | null>(null)

const assetForm = ref({
  assetType: '',
  assetName: '',
  personalityDesc: '',
  promptText: '',
  imageUrl: '',
  remark: ''
})

const assetTabs: {
  label: string
  value: string
  iconNor: string
  iconSel: string
}[] = reactive([{ label: '全部', value: 'all', iconNor: sceneNor, iconSel: sceneSel }])

const assetTypes = ref<UserAssetCustomTypeItem[]>([])
const assetTypeNameMap = computed(() => {
  const m = new Map<string, string>()
  for (const t of assetTypes.value) m.set(t.code, t.name || t.code)
  return m
})
const assetTypeSelectOptions = computed(() =>
  assetTypes.value.map((t) => ({ value: t.code, label: t.name || t.code }))
)

const PLACEHOLDER_THUMB = emptyImageIconUrl

const myAssets = ref<AssetItem[]>([])
const assetListTotal = ref(0)

function iconPairForType(code: string): { iconNor: string; iconSel: string } {
  const normalizedCode = String(code || '').toLowerCase()
  if (code === 'reference_scene') return { iconNor: sceneNor, iconSel: sceneSel }
  if (code === 'reference_character') return { iconNor: characterNor, iconSel: characterSel }
  if (code === 'reference_prop') return { iconNor: propNor, iconSel: propSel }
  if (normalizedCode.includes('mood')) return { iconNor: emotionNor, iconSel: emotionSel }
  // 后端表情资产类型一般是 expression（表情），兼容 emoji/emoj 命名
  if (
    normalizedCode.includes('expression') ||
    normalizedCode.includes('emoji') ||
    normalizedCode.includes('emoj')
  )
    return { iconNor: emojiNor, iconSel: emojiSel }
  if (normalizedCode.includes('posture') || normalizedCode.includes('pose')) return { iconNor: postureNor, iconSel: postureSel }
  if (normalizedCode.includes('parameter') || normalizedCode.includes('camera')) return { iconNor: parameterNor, iconSel: parameterSel }
  if (normalizedCode.includes('file')) return { iconNor: fileNor, iconSel: fileSel }
  if (code === 'style') return { iconNor: styleNor, iconSel: styleSel }
  if (code === 'effect' || normalizedCode.includes('effect')) return { iconNor: effectNor, iconSel: effectSel }
  return { iconNor: recordingNor, iconSel: recordingSel }
}

function mapRowToAssetItem(row: MergedAssetVO): AssetItem {
  const thumb = row.imageUrl?.trim() || ''
  const hasCover = !!thumb

  return {
    id: String(row.id),
    name: row.assetName || '未命名资产',
    type: row.assetType || '',
    typeName: assetTypeNameMap.value.get(row.assetType || '') || row.assetType || '未知类型',
    thumbnail: hasCover ? thumb : PLACEHOLDER_THUMB,
    hasCover,
    createdAt: row.createTime || '',
    sourceFlag: row.sourceFlag || 'custom',
    raw: row
  }
}

function isUserOwnedAsset(asset: AssetItem): boolean {
  return isMergedAssetUserOwned(asset.sourceFlag)
}

let latestFetchToken = 0

async function fetchAssetList() {
  const fetchToken = ++latestFetchToken
  try {
    const { total, list } = await userAssetMergedPage({
      assetType: activeTab.value === 'all' ? undefined : activeTab.value,
      keyword: searchQuery.value.trim() || undefined,
      pageNum: 1,
      pageSize: 100
    })
    if (fetchToken !== latestFetchToken) return
    myAssets.value = list.map(mapRowToAssetItem)
    assetListTotal.value = total
  } catch {
    if (fetchToken !== latestFetchToken) return
    myAssets.value = []
    assetListTotal.value = 0
    message.error('查询资产列表失败，请稍后重试')
  }
}

const assetsEmpty = computed(() => myAssets.value.length === 0)

const statItems = computed(() => {
  const all = myAssets.value
  const total = assetListTotal.value
  const types = new Set(all.map((a) => a.type)).size
  return [
    { key: 'total', label: '总资产', value: String(total) },
    { key: 'custom', label: '自定义', value: String(all.length) },
    { key: 'search', label: '搜索结果', value: String(all.length) },
    { key: 'types', label: '类型数', value: String(types) }
  ]
})

const formatDate = (dateString: string) => {
  if (!dateString) return '--'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

/** 首屏由 loadAssetTypesAndList 拉取；Tab/搜索变化再请求，避免与挂载叠成双请求 */
let assetsBootstrapped = false

onMounted(() => {
  void loadAssetTypesAndList()
})

watch(activeTab, () => {
  if (!assetsBootstrapped) return
  void fetchAssetList()
})

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, () => {
  if (!assetsBootstrapped) return
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void fetchAssetList()
  }, 300)
})

onBeforeUnmount(() => {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
})

function openAssetPreview(asset: AssetItem) {
  const imageUrl = asset.raw.imageUrl?.trim() || (asset.hasCover ? asset.thumbnail : '')
  if (!imageUrl) {
    message.info('该资产暂无图片可预览')
    return
  }
  openImagePreviewModal({
    url: imageUrl,
    title: asset.name
  })
}

async function loadAssetTypesAndList() {
  try {
    const types = await userAssetCustomTypeList()
    assetTypes.value = types
    const tabs = [{ label: '全部', value: 'all', iconNor: assetAllNor, iconSel: assetAllSel }]
    for (const t of types) {
      const ico = iconPairForType(t.code)
      tabs.push({ label: t.name || t.code, value: t.code, iconNor: ico.iconNor, iconSel: ico.iconSel })
    }
    assetTabs.splice(0, assetTabs.length, ...tabs)
    if (activeTab.value !== 'all' && !tabs.some((t) => t.value === activeTab.value)) {
      activeTab.value = 'all'
    }
  } catch {
    message.error('查询资产类型失败，请稍后重试')
  } finally {
    await fetchAssetList()
    assetsBootstrapped = true
  }
}

function resetAssetForm() {
  assetForm.value = {
    assetType: assetTypes.value[0]?.code || '',
    assetName: '',
    personalityDesc: '',
    promptText: '',
    imageUrl: '',
    remark: ''
  }
}

function openCreateModal() {
  assetFormMode.value = 'create'
  editingAssetId.value = null
  assetCoverUploading.value = false
  resetAssetForm()
  assetFormOpen.value = true
}

async function openEditModal(asset: AssetItem) {
  if (!isUserOwnedAsset(asset)) {
    message.info('官方素材不可编辑')
    return
  }
  const idNum = Number(asset.id)
  if (!Number.isFinite(idNum) || idNum <= 0) {
    message.error('资产ID无效，无法编辑')
    return
  }
  try {
    const detail = await userAssetCustomDetail({ id: idNum })
    assetFormMode.value = 'edit'
    editingAssetId.value = idNum
    assetForm.value = {
      assetType: detail.assetType || '',
      assetName: detail.assetName || '',
      personalityDesc: detail.personalityDesc || '',
      promptText: detail.promptText || '',
      imageUrl: detail.imageUrl || '',
      remark: detail.remark || ''
    }
    assetCoverUploading.value = false
    if (assetCoverInputRef.value) assetCoverInputRef.value.value = ''
    assetFormOpen.value = true
  } catch (err: any) {
    message.error(err?.msg || err?.message || '加载资产详情失败')
  }
}

function closeAssetFormModal() {
  assetFormOpen.value = false
  assetCoverUploading.value = false
  if (assetCoverInputRef.value) assetCoverInputRef.value.value = ''
}

function triggerAssetCoverUpload() {
  if (assetCoverUploading.value) return
  assetCoverInputRef.value?.click()
}

function clearAssetCover() {
  assetForm.value.imageUrl = ''
  if (assetCoverInputRef.value) assetCoverInputRef.value.value = ''
}

async function onAssetCoverFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  if (!file.type.startsWith('image/')) {
    message.warning('只能上传图片文件')
    return
  }
  if (file.size / 1024 / 1024 >= 10) {
    message.warning('图片大小不能超过 10MB')
    return
  }

  assetCoverUploading.value = true
  try {
    const url = await uploadImageToOssWithToast(file)
    if (url) assetForm.value.imageUrl = url
  } finally {
    assetCoverUploading.value = false
  }
}

function validateAssetForm(): string | null {
  if (!assetForm.value.assetType.trim()) return '请选择资产类型'
  if (!assetForm.value.assetName.trim()) return '请填写资产名称'
  return null
}

async function submitAssetForm() {
  const errText = validateAssetForm()
  if (errText) {
    message.warning(errText)
    return
  }
  assetSubmitting.value = true
  try {
    const payload = {
      assetType: assetForm.value.assetType.trim(),
      assetName: assetForm.value.assetName.trim(),
      personalityDesc: assetForm.value.personalityDesc.trim() || undefined,
      promptText: assetForm.value.promptText.trim() || undefined,
      imageUrl: assetForm.value.imageUrl.trim() || undefined,
      remark: assetForm.value.remark.trim() || undefined
    }
    if (assetFormMode.value === 'create') {
      await userAssetCustomCreate(payload)
      message.success('创建成功')
    } else {
      if (!editingAssetId.value) throw new Error('缺少资产ID')
      await userAssetCustomUpdate({
        id: editingAssetId.value,
        assetName: payload.assetName,
        personalityDesc: payload.personalityDesc,
        promptText: payload.promptText,
        imageUrl: payload.imageUrl,
        remark: payload.remark
      })
      message.success('修改成功')
    }
    assetFormOpen.value = false
    await fetchAssetList()
  } catch (err: any) {
    message.error(err?.msg || err?.message || (assetFormMode.value === 'create' ? '创建失败' : '修改失败'))
  } finally {
    assetSubmitting.value = false
  }
}

function removeAsset(asset: AssetItem) {
  if (!isUserOwnedAsset(asset)) {
    message.info('官方素材不可删除')
    return
  }
  Modal.confirm({
    class: 'home-confirm-modal',
    wrapClassName: 'create-flow-modal home-confirm-wrap',
    centered: true,
    title: '删除资产',
    content: `确认删除「${asset.name}」吗？`,
    okText: '删除',
    cancelText: '取消',
    okType: 'danger',
    async onOk() {
      try {
        await userAssetCustomDelete({ id: Number(asset.id) })
        message.success('删除成功')
        await fetchAssetList()
      } catch (err: any) {
        message.error(err?.msg || err?.message || '删除失败')
      }
    }
  })
}
</script>

<style scoped>
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
  transition: transform 0.35s ease;
}

.works-lib-card:hover .works-lib-card__cover :deep(.works-lib-card__cover-img) {
  transform: scale(1.04);
}

.works-lib-grid:has(> .works-lib-empty--full) {
  display: flex;
  flex-direction: column;
}

.works-lib-empty--full {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.works-lib-empty__icon-img {
  width: 80px;
  height: 80px;
  object-fit: contain;
  margin-bottom: 10px;
}

.works-lib-card__title-input {
  width: 100%;
  height: 28px;
  border: 1px solid rgba(74, 231, 253, 0.45);
  border-radius: 6px;
  background: rgba(9, 18, 31, 0.95);
  color: #e6edf3;
  outline: none;
  padding: 0 8px;
  font-size: 14px;
}

/* 与 BatchRegenerateDubbingModal .brdm 同思路：限高 + 中部滚动 + 底栏固定 */
.asset-form-modal {
  padding: 8px 0 0;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  max-height: calc(100vh - 160px);
  overflow: hidden;
}

.asset-form-modal__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 12px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.asset-form-modal__grid::-webkit-scrollbar {
  display: none;
}

.asset-form-item {
  margin-bottom: 14px;
}

.asset-form-item--half {
  grid-column: span 1;
}

.asset-form-item--full {
  grid-column: 1 / -1;
}

.asset-form-item--upload {
  margin-bottom: 18px;
}

.asset-form-item--upload :deep(.ant-form-item-label) {
  display: none;
}

.style-cover-upload {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.style-cover-upload--header {
  width: 100%;
  align-items: center;
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px dashed rgba(74, 231, 253, 0.22);
  background: rgba(8, 11, 18, 0.55);
  box-sizing: border-box;
}

.style-cover-upload__box {
  width: 120px;
  height: 120px;
  border: 1px dashed rgba(74, 231, 253, 0.35);
  border-radius: 8px;
  background: rgba(8, 11, 18, 0.96);
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  flex-shrink: 0;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.style-cover-upload__box:hover:not(:disabled) {
  border-color: rgba(74, 231, 253, 0.55);
  background: rgba(14, 89, 250, 0.1);
}

.style-cover-upload__box:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.style-cover-upload__box--filled {
  border-style: solid;
  border-color: rgba(74, 231, 253, 0.25);
}

.style-cover-upload__placeholder,
.style-cover-upload__hint {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #8e97a5;
  font-size: 12px;
}

.style-cover-upload__icon {
  font-size: 22px;
  color: rgba(74, 231, 253, 0.55);
}

.style-cover-upload :deep(.style-cover-upload__preview) {
  width: 100%;
  height: 100%;
}

.style-cover-upload :deep(.style-cover-upload__img) {
  width: 100%;
  height: 100%;
  display: block;
}

.style-cover-upload__meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;
}

.style-cover-upload__tip {
  margin: 0;
  color: #7f8ba0;
  font-size: 12px;
  line-height: 18px;
}

.style-cover-upload__remove {
  color: var(--home-cyan, #4ae7fd);
  font-size: 12px;
  cursor: pointer;
}

.style-cover-upload__remove:hover {
  color: #7ef0ff;
}

.asset-form-modal__footer {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  margin-top: 0;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.asset-form-modal :deep(.ant-form-item-label > label) {
  color: rgba(220, 231, 245, 0.85);
  font-size: 14px;
  line-height: 20px;
}

.asset-form-modal :deep(.ant-input),
.asset-form-modal :deep(.ant-input-affix-wrapper),
.asset-form-modal :deep(.ant-input-textarea textarea),
.asset-form-modal :deep(.ant-select-selector) {
  background: rgba(8, 11, 18, 0.96) !important;
  border: none !important;
  color: #e6edf3 !important;
  border-radius: 8px !important;
  box-shadow: none !important;
}

.asset-form-modal :deep(input.ant-input),
.asset-form-modal :deep(.ant-input-affix-wrapper) {
  height: 40px;
}

.asset-form-modal :deep(.ant-select-selector) {
  min-height: 40px !important;
  height: 40px !important;
  display: flex;
  align-items: center;
}

.asset-form-modal :deep(.ant-select-selection-item),
.asset-form-modal :deep(.ant-select-selection-placeholder) {
  line-height: 40px !important;
}

.asset-form-modal :deep(.ant-input-textarea textarea) {
  min-height: 110px !important;
  height: 110px !important;
  line-height: 22px;
  padding: 10px 12px;
  resize: none;
}

.asset-form-modal :deep(.ant-input:focus),
.asset-form-modal :deep(.ant-input-focused),
.asset-form-modal :deep(.ant-input-affix-wrapper:focus),
.asset-form-modal :deep(.ant-input-affix-wrapper-focused),
.asset-form-modal :deep(.ant-input-textarea textarea:focus),
.asset-form-modal :deep(.ant-select-focused .ant-select-selector) {
  border: none !important;
  box-shadow: none !important;
}

.asset-form-modal :deep(.ant-input::placeholder),
.asset-form-modal :deep(.ant-input-textarea textarea::placeholder),
.asset-form-modal :deep(.ant-select-selection-placeholder) {
  color: #7f8ba0 !important;
}

.asset-form-modal :deep(.ant-select-arrow) {
  color: #8fa3c0;
}

@media (max-width: 768px) {
  .asset-form-modal__grid {
    grid-template-columns: 1fr;
    column-gap: 0;
  }

  .asset-form-item--half,
  .asset-form-item--full {
    grid-column: 1 / -1;
  }
}
</style>
