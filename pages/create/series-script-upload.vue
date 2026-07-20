<template>
  <div
    class="series-script-upload"
    :class="{ 'is-dragging': isDragging && !hasFile }"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <!-- 未选择文件：空状态 -->
    <div v-if="!hasFile" class="series-script-upload__panel">
      <div class="series-script-upload__icon" aria-hidden="true">
        <img src="/assets/img/icon/empty-bg.svg" alt="" />
      </div>
      <p class="series-script-upload__hint">
        支持 doc / docx / txt 格式，剧本字数不超过10万字，可拖拽至此处上传
      </p>
      <input
        ref="fileInputRef"
        type="file"
        class="series-script-upload__input"
        accept=".docx,.doc,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        @change="onFileChange"
      />
      <button type="button" class="series-script-upload__btn" @click="openPicker">
        <CloudUploadOutlined class="series-script-upload__btn-ico" />
        <span class="series-script-upload__btn-text">上传剧本</span>
      </button>
      <button type="button" class="series-script-upload__skip" @click="goStoryScriptSkip">
        暂不上传，直接进入剧本编辑
      </button>
    </div>

    <!-- 已选文件：设计稿「上传成功后」 -->
    <div v-else class="series-script-upload__done">
      <div class="series-script-upload__file-card">
        <div class="series-script-upload__word-badge" aria-hidden="true">W</div>
        <div class="series-script-upload__file-info">
          <div class="series-script-upload__file-name">{{ displayFileName }}</div>
          <div class="series-script-upload__file-meta">Docx·{{ fileSizeLabel }}</div>
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

      <p class="series-script-upload__guide">
        点击按钮，为您自动分集并提取剧本中角色、场景、道具初稿，列表页可单独修改。
      </p>

      <button
        type="button"
        class="series-script-upload__parse"
        :disabled="parsing"
        @click="onParseScript"
      >
        <img src="/assets/img/icon/lightning.svg" alt="" class="series-script-upload__parse-ico">
        <span v-if="parsing" class="series-script-upload__parse-loading">解析中…</span>
        <span v-else>解析剧本</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import { CloudUploadOutlined, CloseOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import { useCreationStore } from '~/stores/creation'
import { creationStepAdvance, userScriptUpload } from '~/utils/businessApi'
import { ensureScriptSaveContextForUpload } from '~/utils/ensureSeriesScriptContext'
import { scriptApiTextToEditorHtml, storyScriptOriginalTextForApi } from '~/utils/htmlPlain'
import { CREATE_SERIES_EPISODE_LIST_PATH } from '~/utils/createFlowRoutes'

definePageMeta({ layout: 'create' })

const router = useRouter()
const route = useRoute()
const creationStore = useCreationStore()

const fileInputRef = ref<HTMLInputElement | null>(null)
const pendingFile = ref<File | null>(null)
const displayFileName = ref('')
const isDragging = ref(false)
const parsing = ref(false)
let dragDepth = 0

const MAX_DOCX_BYTES = 15 * 1024 * 1024

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
  const name = file.name.toLowerCase()
  if (!name.endsWith('.docx') && !name.endsWith('.doc') && !name.endsWith('.txt')) {
    message.warning('请上传 doc / docx / txt 格式文件')
    return
  }
  if (file.size > MAX_DOCX_BYTES) {
    message.warning('文件过大，请选择较小的 docx 文件')
    return
  }
  pendingFile.value = file
  displayFileName.value = file.name
}

function removeFile() {
  pendingFile.value = null
  displayFileName.value = ''
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  assignFile(input.files?.[0])
  input.value = ''
}

function onDragEnter() {
  if (hasFile.value) return
  dragDepth += 1
  isDragging.value = true
}

function onDragOver() {
  if (hasFile.value) return
  isDragging.value = true
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) isDragging.value = false
}

function onDrop(e: DragEvent) {
  dragDepth = 0
  isDragging.value = false
  if (hasFile.value) return
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

function goStoryScriptSkip() {
  creationStore.setSeriesFlowEnteredStoryScript(true)
  router.push({ path: '/create/story-script', query: { ...route.query } })
}

async function onParseScript() {
  const file = pendingFile.value
  if (!file || parsing.value) return
  parsing.value = true
  try {
    const ctx = await ensureScriptSaveContextForUpload(creationStore, route)
    if (!ctx) {
      message.error('缺少项目信息，请从首页创建剧集后进入')
      return
    }

    const row = await userScriptUpload({
      file,
      projectId: ctx.projectId
    })
    const bodyText = String(row.originalText ?? '').trim()
    if (!bodyText) {
      message.error('未能从文档中解析出文字，请检查文件内容')
      return
    }

    const editorHtml = scriptApiTextToEditorHtml(bodyText)
    const originalText = storyScriptOriginalTextForApi(editorHtml)
    creationStore.updateFormData({ storyScript: { content: editorHtml } })
    creationStore.setScriptServerHtmlBaseline((row.originalText ?? originalText).trim())

    const advBody = {
      projectId: ctx.projectId,
      episodeId: ctx.projectType === 'movie' ? 0 : ctx.episodeId,
      completedStep: 2
    }
    try {
      await creationStepAdvance(advBody)
    } catch {
      /* 服务端未配置步骤时仍可进入下一步编辑 */
    }

    creationStore.setSeriesFlowEnteredStoryScript(true)
    message.success('剧本已保存')
    router.push({
      path: CREATE_SERIES_EPISODE_LIST_PATH,
      query: buildFlowQuery(ctx.projectId, ctx.episodeId, ctx.projectType)
    })
  } catch (e: unknown) {
    const err = e as { msg?: string; message?: string }
    message.error(err?.msg || err?.message || '解析或保存失败，请稍后重试')
  } finally {
    parsing.value = false
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

.series-script-upload__done {
  flex: 1;
  min-height: min(696px, calc(100vh - 220px));
  width: 100%;
  padding: 12px 68px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 1.5rem;
  background: #111621;
  border-radius: 8px;
}

.series-script-upload__file-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid #4ae7fd;
  border-radius: 8px;
  background: rgba(12, 18, 28, 0.6);
  box-sizing: border-box;
}

.series-script-upload__word-badge {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: #2b579a;
  color: #fff;
  font-size: 1.35rem;
  font-weight: 700;
  font-family: system-ui, 'Segoe UI', sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.series-script-upload__file-info {
  flex: 1;
  min-width: 0;
  text-align: left;
}

.series-script-upload__file-name {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  line-height: 1.4;
  word-break: break-all;
}

.series-script-upload__file-meta {
  margin-top: 4px;
  font-size: 13px;
  color: #8e97a5;
  line-height: 1.35;
}

.series-script-upload__close {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #8e97a5;
  font-size: 16px;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.series-script-upload__close:hover {
  color: #fff;
  background: rgba(74, 231, 253, 0.12);
}

.series-script-upload__guide {
  margin: 0;
  max-width: 560px;
  text-align: center;
  font-size: 14px;
  line-height: 1.6;
  color: #8e97a5;
}

.series-script-upload__parse {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  padding: 0 28px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%);
  box-shadow: 0 4px 16px rgba(14, 89, 250, 0.25);
  transition: opacity 0.2s ease, transform 0.15s ease;
}

.series-script-upload__parse:hover:not(:disabled) {
  opacity: 0.95;
  transform: translateY(-1px);
}

.series-script-upload__parse:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  transform: none;
}

.series-script-upload__parse-ico {
  width: 16px;
  height: 16px;
}

.series-script-upload__parse-loading {
  letter-spacing: 0.02em;
}

.series-script-upload__icon {
  line-height: 0;
  opacity: 0.85;
}

.series-script-upload__icon img {
  width: 80px;
  height: auto;
  display: block;
}

.series-script-upload__hint {
  margin: 0;
  font-size: 14px;
  line-height: 1.43;
  font-weight: 400;
  color: #8e97a5;
}

.series-script-upload__input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.series-script-upload__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 36px;
  padding: 0 14px;
  margin-top: 0.25rem;
  border-radius: 8px;
  border: 1px solid rgba(74, 231, 253, 0.3);
  background: #121212;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.series-script-upload__btn:hover {
  border-color: rgba(74, 231, 253, 0.5);
  background: rgba(18, 18, 18, 0.95);
}

.series-script-upload__btn-ico {
  font-size: 16px;
  color: rgba(74, 231, 253, 0.9);
}

.series-script-upload__btn-text {
  background: linear-gradient(270deg, #4ae7fd 0%, #ffffff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.series-script-upload__skip {
  margin-top: 1rem;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  color: rgba(142, 151, 165, 0.85);
}

.series-script-upload__skip:hover {
  color: rgba(142, 151, 165, 1);
}
</style>
