<template>
  <div
    class="series-script-upload"
    :class="{ 'is-dragging': isDragging && !hasFile && !previewData }"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <!-- 未选择文件：空状态 -->
    <div
      v-if="!hasFile && !previewData"
      class="series-script-upload__panel"
    >
      <div class="series-script-upload__icon" aria-hidden="true">
        <img :src="emptyImageIconUrl" alt="" class="empty-image-icon empty-image-icon--xl" />
      </div>
      <p class="series-script-upload__hint">
        仅支持 .txt 纯文本格式，剧本字数不超过10万字，可拖拽至此处上传
      </p>
      <input
        ref="fileInputRef"
        type="file"
        class="series-script-upload__input"
        accept=".txt,text/plain"
        @change="onFileChange"
      />
      <button type="button" class="series-script-upload__btn" @click="openPicker">
        <CloudUploadOutlined class="series-script-upload__btn-ico" />
        <span class="series-script-upload__btn-text">上传剧本</span>
      </button>
      <button type="button" class="series-script-upload__skip" @click="goEpisodeListSkip">
        暂不上传，直接进入剧集列表
      </button>
    </div>

    <!-- 已选文件：待解析 -->
    <div v-else-if="!previewData" class="series-script-upload__done">
      <div class="series-script-upload__file-card">
        <div class="series-script-upload__word-badge" aria-hidden="true">T</div>
        <div class="series-script-upload__file-info">
          <div class="series-script-upload__file-name">{{ displayFileName }}</div>
          <div class="series-script-upload__file-meta">Txt·{{ fileSizeLabel }}</div>
        </div>
        <button
          type="button"
          class="series-script-upload__close"
          aria-label="移除文件"
          @click="removeFile"
        >
          <CloseOutlined />
        </button>
      </div>

      <label class="series-script-upload__keyword">
        <span class="series-script-upload__keyword-label">分集词样例</span>
        <input
          v-model="episodeKeyword"
          type="text"
          class="series-script-upload__keyword-input"
          placeholder="默认：第一集"
          maxlength="50"
        />
      </label>

      <p class="series-script-upload__guide">
        点击按钮预览自动分集结果（只解析不入库），确认后再创建各集剧本。
      </p>

      <button
        type="button"
        class="series-script-upload__parse"
        :disabled="parsing"
        @click="onPreviewSplit"
      >
        <img src="/assets/img/icon/star_black.svg" alt="" class="series-script-upload__parse-ico" />
        <span v-if="parsing" class="series-script-upload__parse-loading">解析中…</span>
        <span v-else>解析剧本</span>
      </button>
    </div>

    <!-- 分集预览确认 -->
    <div v-else class="series-script-upload__preview">
      <div class="series-script-upload__preview-head">
        <h2 class="series-script-upload__preview-title">分集预览</h2>
        <p class="series-script-upload__preview-meta">
          共 {{ previewData.totalEpisodes }} 集
          <template v-if="previewData.totalCharCount != null">
            · {{ previewData.totalCharCount }} 字
          </template>
          <template v-if="previewData.episodeKeyword">
            · 分集词「{{ previewData.episodeKeyword }}」
          </template>
        </p>
      </div>

      <ul class="series-script-upload__preview-list">
        <li
          v-for="item in previewData.items"
          :key="item.episodeNo"
          class="series-script-upload__preview-item"
        >
          <div class="series-script-upload__preview-item-title">
            第{{ item.episodeNo }}集 · {{ item.title }}
          </div>
          <div class="series-script-upload__preview-item-desc">
            {{ item.description || '暂无描述' }}
            <span v-if="item.charCount != null">（{{ item.charCount }} 字）</span>
          </div>
        </li>
      </ul>

      <div class="series-script-upload__preview-actions">
        <button
          type="button"
          class="series-script-upload__preview-back"
          :disabled="confirming"
          @click="backToFile"
        >
          重新选择
        </button>
        <button
          type="button"
          class="series-script-upload__parse"
          :disabled="confirming"
          @click="onConfirmSplit"
        >
          <span v-if="confirming" class="series-script-upload__parse-loading">入库中…</span>
          <span v-else>确认分集并入库</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import { CloudUploadOutlined, CloseOutlined } from '@ant-design/icons-vue'
import { useCreationStore } from '~/stores/creation'
import {
  creationStepAdvance,
  userScriptSplitConfirm,
  userScriptSplitPreview
} from '~/utils/businessApi'
import type { ScriptSplitPreviewVO } from '~/types/business-api'
import { CREATE_SERIES_EPISODE_LIST_PATH } from '~/utils/createFlowRoutes'
import { assertScriptPlainTextFile, validateScriptUploadFile } from '~/utils/scriptFileUpload'
import { emptyImageIconUrl } from '~/utils/emptyImageIcon'
import { fetchUserProjectDetailOnce } from '~/utils/userProjectDetailOnce'

definePageMeta({ layout: 'create' })

const router = useRouter()
const route = useRoute()
const creationStore = useCreationStore()

const fileInputRef = ref<HTMLInputElement | null>(null)
const pendingFile = ref<File | null>(null)
const displayFileName = ref('')
const isDragging = ref(false)
const parsing = ref(false)
const confirming = ref(false)
const episodeKeyword = ref('第一集')
const scriptText = ref('')
const previewData = ref<ScriptSplitPreviewVO | null>(null)
let dragDepth = 0

const MAX_SCRIPT_BYTES = 15 * 1024 * 1024

const hasFile = computed(() => !!pendingFile.value)

const fileSizeLabel = computed(() => {
  const f = pendingFile.value
  if (!f) return ''
  return formatFileSize(f.size)
})

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb >= 10 ? kb.toFixed(0) : kb.toFixed(2)}KB`
  const mb = kb / 1024
  return `${mb.toFixed(2)}MB`
}

function openPicker() {
  fileInputRef.value?.click()
}

function assignFile(file: File | undefined) {
  if (!file) return
  const formatError = validateScriptUploadFile(file)
  if (formatError) {
    message.warning(formatError)
    return
  }
  if (file.size > MAX_SCRIPT_BYTES) {
    message.warning('文件过大，请选择较小的 txt 文件')
    return
  }
  pendingFile.value = file
  displayFileName.value = file.name
  previewData.value = null
  scriptText.value = ''
}

function removeFile() {
  pendingFile.value = null
  displayFileName.value = ''
  previewData.value = null
  scriptText.value = ''
}

function backToFile() {
  previewData.value = null
  scriptText.value = ''
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  assignFile(input.files?.[0])
  input.value = ''
}

function onDragEnter() {
  if (hasFile.value || previewData.value) return
  dragDepth += 1
  isDragging.value = true
}

function onDragOver() {
  if (hasFile.value || previewData.value) return
  isDragging.value = true
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) isDragging.value = false
}

function onDrop(e: DragEvent) {
  dragDepth = 0
  isDragging.value = false
  if (hasFile.value || previewData.value) return
  assignFile(e.dataTransfer?.files?.[0])
}

function buildFlowQuery(projectId: number, episodeId: number, projectType: string) {
  const q: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query)) {
    if (v === undefined || v === null) continue
    q[k] = Array.isArray(v) ? String(v[0] ?? '') : String(v)
  }
  q.projectId = String(projectId)
  q.id = String(projectId)
  q.episodeId = projectType === 'movie' ? '0' : String(episodeId)
  return q
}

function goEpisodeListSkip() {
  creationStore.setSeriesFlowEnteredStoryScript(true)
  router.push({ path: CREATE_SERIES_EPISODE_LIST_PATH, query: { ...route.query } })
}

async function resolveSeriesProjectId(): Promise<number | null> {
  const routePid = Number(route.query.projectId ?? route.query.id ?? route.query.workId)
  const projectId =
    creationStore.currentProjectId ??
    (Number.isFinite(routePid) && routePid > 0 ? routePid : null)
  if (!projectId) return null

  let projectType = creationStore.currentProjectType
  if (!projectType) {
    try {
      const detail = await fetchUserProjectDetailOnce(projectId)
      projectType = detail.projectType
      creationStore.setCurrentProjectType(projectType)
    } catch {
      return null
    }
  }
  if (projectType !== 'series') {
    message.warning('仅剧集项目支持整篇分集导入')
    return null
  }
  return projectId
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsText(file, 'UTF-8')
  })
}

async function onPreviewSplit() {
  const file = pendingFile.value
  if (!file || parsing.value || confirming.value) return
  parsing.value = true
  try {
    const formatError = validateScriptUploadFile(file)
    if (formatError) {
      message.warning(formatError)
      return
    }
    try {
      await assertScriptPlainTextFile(file)
    } catch (e: unknown) {
      const err = e as { message?: string }
      message.error(err?.message || '内容非文本')
      return
    }

    const projectId = await resolveSeriesProjectId()
    if (!projectId) {
      message.error('缺少项目信息，请从首页创建剧集后进入')
      return
    }

    const text = (await readFileAsText(file)).trim()
    if (!text) {
      message.error('未能从文档中解析出文字，请检查文件内容')
      return
    }

    const keyword = episodeKeyword.value.trim() || '第一集'
    const preview = await userScriptSplitPreview({
      projectId,
      scriptText: text,
      episodeKeyword: keyword
    })
    if (!preview.totalEpisodes || !preview.items.length) {
      message.error('未识别分集词')
      return
    }

    scriptText.value = text
    episodeKeyword.value = String(preview.episodeKeyword || keyword)
    previewData.value = preview
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '分集预览失败，请稍后重试')
  } finally {
    parsing.value = false
  }
}

async function onConfirmSplit() {
  if (!previewData.value || confirming.value || parsing.value) return
  const text = scriptText.value.trim()
  if (!text) {
    message.error('剧本文本丢失，请重新解析')
    return
  }

  confirming.value = true
  try {
    const projectId = await resolveSeriesProjectId()
    if (!projectId) {
      message.error('缺少项目信息，请从首页创建剧集后进入')
      return
    }

    const keyword = episodeKeyword.value.trim() || '第一集'
    const result = await userScriptSplitConfirm({
      projectId,
      scriptText: text,
      episodeKeyword: keyword
    })

    const first = result.episodes?.[0]
    const firstEpisodeId = Number(first?.episodeId)
    if (Number.isFinite(firstEpisodeId) && firstEpisodeId > 0) {
      creationStore.setCurrentProjectContext({ projectId, episodeId: firstEpisodeId })
    }

    try {
      await creationStepAdvance({
        projectId,
        episodeId: Number.isFinite(firstEpisodeId) && firstEpisodeId > 0 ? firstEpisodeId : undefined,
        completedStep: 2
      })
    } catch {
      /* 服务端未配置步骤时仍可进入分集列表 */
    }

    creationStore.setSeriesFlowEnteredStoryScript(true)
    message.success(`已创建 ${result.totalEpisodes} 集`)
    router.push({
      path: CREATE_SERIES_EPISODE_LIST_PATH,
      query: buildFlowQuery(
        projectId,
        Number.isFinite(firstEpisodeId) && firstEpisodeId > 0 ? firstEpisodeId : 0,
        'series'
      )
    })
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '分集入库失败，请稍后重试')
  } finally {
    confirming.value = false
  }
}
</script>

<style scoped lang="scss">
.series-script-upload {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  width: 100%;
}

.series-script-upload__panel {
  flex: 1;
  min-height: min(696px, calc(100vh - 220px));
  margin: 0;
  padding: 2.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 1rem;
  background: #111621;
  border: 1px dashed rgba(74, 231, 253, 0.3);
  border-radius: 8px;
  box-sizing: border-box;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.series-script-upload.is-dragging .series-script-upload__panel {
  border-color: rgba(74, 231, 253, 0.65);
  background: rgba(17, 22, 33, 0.92);
}

.series-script-upload__icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.series-script-upload__hint {
  margin: 0;
  max-width: 28rem;
  font-size: 14px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.55);
}

.series-script-upload__input {
  display: none;
}

.series-script-upload__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: #4ae7fd;
  color: #0b1220;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.series-script-upload__btn-ico {
  font-size: 16px;
}

.series-script-upload__skip {
  margin-top: 0.25rem;
  padding: 0;
  border: none;
  background: transparent;
  color: rgba(74, 231, 253, 0.85);
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.series-script-upload__done,
.series-script-upload__preview {
  flex: 1;
  min-height: min(696px, calc(100vh - 220px));
  margin: 0;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  background: #111621;
  border: 1px solid rgba(74, 231, 253, 0.18);
  border-radius: 8px;
  box-sizing: border-box;
}

.series-script-upload__file-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(420px, 100%);
  padding: 14px 16px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.series-script-upload__word-badge {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(74, 231, 253, 0.15);
  color: #4ae7fd;
  font-weight: 700;
}

.series-script-upload__file-info {
  flex: 1;
  min-width: 0;
  text-align: left;
}

.series-script-upload__file-name {
  font-size: 14px;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.series-script-upload__file-meta {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.series-script-upload__close {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  padding: 4px;
}

.series-script-upload__keyword {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  width: min(420px, 100%);
}

.series-script-upload__keyword-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

.series-script-upload__keyword-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  font-size: 14px;
  outline: none;
}

.series-script-upload__keyword-input:focus {
  border-color: rgba(74, 231, 253, 0.55);
}

.series-script-upload__guide {
  margin: 0;
  max-width: 28rem;
  font-size: 13px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.55);
  text-align: center;
}

.series-script-upload__parse {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 180px;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  background: #4ae7fd;
  color: #0b1220;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.series-script-upload__parse:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.series-script-upload__parse-ico {
  width: 16px;
  height: 16px;
}

.series-script-upload__preview {
  align-items: stretch;
  justify-content: flex-start;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}

.series-script-upload__preview-head {
  text-align: left;
}

.series-script-upload__preview-title {
  margin: 0;
  font-size: 18px;
  color: #fff;
  font-weight: 600;
}

.series-script-upload__preview-meta {
  margin: 6px 0 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
}

.series-script-upload__preview-list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.series-script-upload__preview-item {
  padding: 12px 14px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.series-script-upload__preview-item-title {
  font-size: 14px;
  color: #fff;
  font-weight: 600;
}

.series-script-upload__preview-item-desc {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.55);
}

.series-script-upload__preview-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.series-script-upload__preview-back {
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  font-size: 14px;
  cursor: pointer;
}

.series-script-upload__preview-back:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
