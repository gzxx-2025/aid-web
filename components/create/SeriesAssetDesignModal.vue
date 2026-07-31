<template>
  <a-modal
    v-model:open="modalOpen"
    :width="1100"
    :footer="null"
    :title="null"
    :closable="false"
    centered
    class="series-asset-design-modal"
    wrap-class-name="create-flow-modal series-asset-design-modal-wrap"
    @cancel="handleCancel"
  >
    <div class="sad-shell">
      <header class="sad-header">
        <h2 class="sad-title">{{ modalTitle }}</h2>
        <button
          type="button"
          class="sad-close"
          aria-label="关闭"
          :disabled="busy"
          @click="handleCancel"
        >
          <CloseOutlined />
        </button>
      </header>

      <div class="sad-body">
        <section class="sad-media">
          <div class="sad-media__frame">
            <div v-if="imageGenerating" class="sad-media__generating" role="status" aria-live="polite">
              <LoadingOutlined spin class="sad-media__generating-icon" />
              <p class="sad-media__generating-text">{{ generatingText }}</p>
            </div>
            <template v-else-if="previewUrl">
              <img :src="previewUrl" alt="" class="sad-media__preview" />
              <div class="sad-media__overlay-actions">
                <button
                  type="button"
                  class="sad-action-btn sad-action-btn--ghost sad-action-btn--compact"
                  :disabled="busy"
                  @click="handleManualUpload"
                >
                  重新上传
                </button>
                <button
                  type="button"
                  class="sad-action-btn sad-action-btn--primary sad-action-btn--compact"
                  :disabled="busy"
                  @click="handleAutoGenerate"
                >
                  重新生成
                </button>
              </div>
            </template>
            <template v-else>
              <div class="sad-media__placeholder">
                <UserAddOutlined class="sad-media__placeholder-icon" />
              </div>
              <div class="sad-media__actions">
                <button
                  type="button"
                  class="sad-action-btn sad-action-btn--ghost"
                  :disabled="busy"
                  @click="handleManualUpload"
                >
                  手动上传
                </button>
                <button
                  type="button"
                  class="sad-action-btn sad-action-btn--primary"
                  :disabled="busy"
                  @click="handleAutoGenerate"
                >
                  <img src="/assets/img/icon/star_white.svg" alt="" class="sad-action-btn__star" />
                  智能生成
                </button>
              </div>
            </template>
          </div>
        </section>

        <section class="sad-form asset-form-modal">
          <template v-if="assetType === 'character'">
            <div class="sad-field">
              <label class="sad-label">名称</label>
              <a-input
                v-model:value="characterForm.name"
                maxlength="100"
                placeholder="请输入角色名称"
                :disabled="busy"
              />
            </div>
            <div class="sad-field">
              <label class="sad-label">年龄</label>
              <a-select
                v-model:value="characterForm.ageRange"
                :options="ageOptions"
                placeholder="请选择"
                :disabled="busy"
              />
            </div>
            <div class="sad-field">
              <label class="sad-label">性别</label>
              <a-select
                v-model:value="characterForm.gender"
                :options="genderOptions"
                placeholder="请选择"
                :disabled="busy"
              />
            </div>
            <div class="sad-field">
              <label class="sad-label">人物描述</label>
              <a-textarea
                v-model:value="characterForm.introduction"
                :rows="3"
                maxlength="500"
                placeholder="请输入人物描述"
                :disabled="busy"
              />
            </div>
            <div class="sad-field">
              <label class="sad-label">背景故事</label>
              <a-textarea
                v-model:value="characterForm.backgroundStory"
                :rows="4"
                maxlength="1000"
                placeholder="请输入背景故事"
                :disabled="busy"
              />
            </div>
          </template>

          <template v-else>
            <div class="sad-field">
              <label class="sad-label">名称</label>
              <a-input
                v-model:value="propForm.name"
                maxlength="100"
                placeholder="请输入道具名称"
                :disabled="busy"
              />
            </div>
            <div class="sad-field">
              <label class="sad-label">道具概要</label>
              <a-textarea
                v-model:value="propForm.summary"
                :rows="3"
                maxlength="500"
                placeholder="请输入道具概要"
                :disabled="busy"
              />
            </div>
            <div class="sad-field">
              <label class="sad-label">道具描述</label>
              <a-textarea
                v-model:value="propForm.introduction"
                :rows="5"
                maxlength="1000"
                placeholder="请输入道具描述"
                :disabled="busy"
              />
            </div>
          </template>
        </section>
      </div>

      <footer class="sad-footer">
        <a-button class="sad-footer-btn sad-footer-btn--ghost" :disabled="busy" @click="handleCancel">
          取消
        </a-button>
        <a-button
          type="primary"
          class="sad-footer-btn sad-footer-btn--ok"
          :loading="confirming"
          :disabled="busy && !confirming"
          @click="handleConfirm"
        >
          <template #icon><CheckOutlined /></template>
          确认
        </a-button>
      </footer>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="sad-file-input"
      @change="onFilePicked"
    />
  </a-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { CheckOutlined, CloseOutlined, LoadingOutlined, UserAddOutlined } from '@ant-design/icons-vue'
import { uploadImageToOssWithToast } from '~/utils/ossUpload'
import {
  ensureSeriesAssetDraft,
  generateSeriesAssetImage,
  resolveSeriesAssetImageCost,
  uploadSeriesAssetManualImage,
  validateSeriesAssetDesignForm,
  type SeriesAssetDesignType,
  type SeriesAssetDraftState,
  type SeriesCharacterDesignForm,
  type SeriesPropDesignForm
} from '~/utils/seriesAssetDesignFlow'

interface Props {
  open: boolean
  assetType: SeriesAssetDesignType
  projectId: number | null
  episodeId: number | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  success: []
}>()

const modalOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const modalTitle = computed(() => (props.assetType === 'character' ? '角色设计' : '道具设计'))

const characterForm = reactive<SeriesCharacterDesignForm>({
  name: '',
  ageRange: '青年',
  gender: '男',
  introduction: '',
  backgroundStory: ''
})

const propForm = reactive<SeriesPropDesignForm>({
  name: '',
  summary: '',
  introduction: ''
})

const ageOptions = [
  { label: '儿童', value: '儿童' },
  { label: '少年', value: '少年' },
  { label: '青年', value: '青年' },
  { label: '中年', value: '中年' },
  { label: '老年', value: '老年' }
]

const genderOptions = [
  { label: '男', value: '男' },
  { label: '女', value: '女' },
  { label: '其他', value: '其他' }
]

const draft = ref<SeriesAssetDraftState | null>(null)
const previewUrl = ref<string | null>(null)
const imageGenerating = ref(false)
const generatingText = ref('正在生成图片…')
const confirming = ref(false)
const uploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const busy = computed(() => imageGenerating.value || confirming.value || uploading.value)

const activeForm = computed(() =>
  props.assetType === 'character' ? ({ ...characterForm } as SeriesCharacterDesignForm) : ({ ...propForm } as SeriesPropDesignForm)
)

function resetState() {
  characterForm.name = ''
  characterForm.ageRange = '青年'
  characterForm.gender = '男'
  characterForm.introduction = ''
  characterForm.backgroundStory = ''
  propForm.name = ''
  propForm.summary = ''
  propForm.introduction = ''
  draft.value = null
  previewUrl.value = null
  imageGenerating.value = false
  generatingText.value = '正在生成图片…'
  confirming.value = false
  uploading.value = false
}

function ensureContext(): { projectId: number; episodeId: number } | null {
  const projectId = Number(props.projectId)
  const episodeId = Number(props.episodeId)
  if (!Number.isFinite(projectId) || projectId <= 0) {
    message.warning('缺少项目信息')
    return null
  }
  if (!Number.isFinite(episodeId) || episodeId <= 0) {
    message.warning('请先新增至少一集后再添加资产')
    return null
  }
  return { projectId, episodeId }
}


watch(
  () => [props.open, props.assetType, props.projectId] as const,
  ([open]) => {
    if (!open) {
      resetState()
      return
    }
  }
)

function handleCancel() {
  if (busy.value) return
  modalOpen.value = false
}

function handleManualUpload() {
  if (busy.value) return
  const err = validateSeriesAssetDesignForm(props.assetType, activeForm.value)
  if (err) {
    message.warning(err)
    return
  }
  fileInputRef.value?.click()
}

async function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const ctx = ensureContext()
  if (!ctx) return

  uploading.value = true
  try {
    const url = await uploadImageToOssWithToast(file)
    if (!url) return
    draft.value = await uploadSeriesAssetManualImage({
      projectId: ctx.projectId,
      episodeId: ctx.episodeId,
      assetType: props.assetType,
      form: activeForm.value,
      imageUrl: url,
      draft: draft.value
    })
    previewUrl.value = url
    message.success('图片上传成功')
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

async function handleAutoGenerate() {
  if (busy.value) return
  const err = validateSeriesAssetDesignForm(props.assetType, activeForm.value)
  if (err) {
    message.warning(err)
    return
  }
  const ctx = ensureContext()
  if (!ctx) return

  imageGenerating.value = true
  generatingText.value = '正在生成图片…'
  try {
    draft.value = await generateSeriesAssetImage({
      projectId: ctx.projectId,
      episodeId: ctx.episodeId,
      assetType: props.assetType,
      form: activeForm.value,
      draft: draft.value,
      onProgress: (p) => {
        if (p.message) generatingText.value = p.message
      }
    })
    previewUrl.value = draft.value.imageUrl ?? null
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '生成失败')
  } finally {
    imageGenerating.value = false
  }
}

async function handleConfirm() {
  if (busy.value) return
  const err = validateSeriesAssetDesignForm(props.assetType, activeForm.value)
  if (err) {
    message.warning(err)
    return
  }
  const ctx = ensureContext()
  if (!ctx) return

  confirming.value = true
  try {
    if (!draft.value) {
      draft.value = await ensureSeriesAssetDraft({
        projectId: ctx.projectId,
        episodeId: ctx.episodeId,
        assetType: props.assetType,
        form: activeForm.value
      })
    } else {
      draft.value = await ensureSeriesAssetDraft({
        projectId: ctx.projectId,
        episodeId: ctx.episodeId,
        assetType: props.assetType,
        form: activeForm.value,
        existing: draft.value
      })
    }
    message.success(props.assetType === 'character' ? '角色已保存' : '道具已保存')
    emit('success')
    modalOpen.value = false
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '保存失败')
  } finally {
    confirming.value = false
  }
}
</script>

<style scoped lang="scss">
:global(.series-asset-design-modal-wrap .ant-modal-content) {
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
}

:global(.series-asset-design-modal-wrap .ant-modal-body) {
  padding: 0 !important;
}

.sad-shell {
  width: 1100px;
  max-width: calc(100vw - 32px);
  height: 698px;
  max-height: calc(100dvh - 80px);
  background: #191a1d;
  border-radius: 8px;
  color: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sad-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px 0;
  flex-shrink: 0;
}

.sad-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
}

.sad-close {
  border: none;
  background: transparent;
  color: #fff;
  cursor: pointer;
  font-size: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.sad-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
  grid-template-rows: 1fr;
  align-items: stretch;
  gap: 16px;
  padding: 16px 24px;
  box-sizing: border-box;
}

.sad-media {
  height: 100%;
  min-height: 0;
  display: flex;
}

.sad-media__frame {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 8px;
  background: #111621;
  border: 1px solid rgba(74, 231, 253, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.sad-media__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.sad-media__placeholder-icon {
  font-size: 40px;
  color: rgba(142, 151, 165, 0.85);
}

.sad-media__preview {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #0d1118;
}

.sad-media__overlay-actions {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: auto;
  max-width: calc(100% - 32px);
}

.sad-media__generating-icon {
  font-size: 22px;
  color: #4ae7fd;
}

.sad-media__generating {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px;
  text-align: center;
}

.sad-media__generating-text {
  margin: 0;
  font-size: 13px;
  color: #8e97a5;
}

.sad-media__actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  width: auto;
  max-width: calc(100% - 32px);
}

.sad-action-btn {
  width: auto;
  min-width: 0;
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
  transition: opacity 0.15s ease, transform 0.15s ease;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.sad-action-btn--compact {
  height: 32px;
  padding: 0 12px;
  font-size: 13px;
}

.sad-action-btn--ghost {
  border: 1px solid rgba(74, 231, 253, 0.45);
  background: rgba(18, 18, 18, 0.9);
  color: #fff;
}

.sad-action-btn--primary {
  border: none;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%);
  color: #fff;
}

.sad-action-btn__star {
  width: 12px;
  height: 12px;
}

.sad-action-btn__cost {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 2px;
  font-size: 12px;
}

.sad-action-btn__diamond {
  width: 12px;
  height: 12px;
}

.sad-form {
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid rgba(74, 231, 253, 0.2);
  overflow: auto;
}

.sad-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.sad-label {
  font-size: 14px;
  line-height: 20px;
  color: rgba(220, 231, 245, 0.85);
}

/* 与 AssetsLibraryPanel「新增资产」输入框一致 */
.sad-form :deep(.ant-input),
.sad-form :deep(.ant-input-affix-wrapper),
.sad-form :deep(.ant-input-textarea textarea),
.sad-form :deep(.ant-select-selector) {
  background: rgba(8, 11, 18, 0.96) !important;
  border: none !important;
  color: #e6edf3 !important;
  border-radius: 8px !important;
  box-shadow: none !important;
}

.sad-form :deep(input.ant-input),
.sad-form :deep(.ant-input-affix-wrapper) {
  height: 40px;
}

.sad-form :deep(.ant-select-selector) {
  min-height: 40px !important;
  height: 40px !important;
  display: flex;
  align-items: center;
}

.sad-form :deep(.ant-select-selection-item),
.sad-form :deep(.ant-select-selection-placeholder) {
  line-height: 40px !important;
  color: #e6edf3 !important;
}

.sad-form :deep(.ant-input-textarea textarea) {
  min-height: 88px !important;
  line-height: 22px;
  padding: 10px 12px;
  resize: none;
}

.sad-form :deep(.ant-input:focus),
.sad-form :deep(.ant-input-focused),
.sad-form :deep(.ant-input-affix-wrapper:focus),
.sad-form :deep(.ant-input-affix-wrapper-focused),
.sad-form :deep(.ant-input-textarea textarea:focus),
.sad-form :deep(.ant-select-focused .ant-select-selector) {
  border: none !important;
  box-shadow: none !important;
}

.sad-form :deep(.ant-input::placeholder),
.sad-form :deep(.ant-input-textarea textarea::placeholder),
.sad-form :deep(.ant-select-selection-placeholder) {
  color: #7f8ba0 !important;
}

.sad-form :deep(.ant-select-arrow) {
  color: #8fa3c0;
}

.sad-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 24px 20px;
  flex-shrink: 0;
}

.sad-footer-btn {
  min-width: 96px;
  height: 40px;
  border-radius: 8px;
}

.sad-footer-btn--ghost {
  background: #121212;
  border-color: rgba(74, 231, 253, 0.3);
  color: #fff;
}

.sad-footer-btn--ok {
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%);
  border: none;
}

.sad-file-input {
  display: none;
}

@media (max-width: 900px) {
  .sad-shell {
    height: auto;
    max-height: calc(100dvh - 40px);
  }

  .sad-body {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    overflow: auto;
  }

  .sad-media,
  .sad-form {
    height: auto;
  }

  .sad-media__frame {
    min-height: 280px;
  }
}
</style>
