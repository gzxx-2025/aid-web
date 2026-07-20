<template>
  <a-modal
    v-model:open="localOpen"
    :width="1000"
    :footer="null"
    class="storyboard-script-modal"
    wrap-class-name="create-flow-modal"
    @cancel="handleCancel"
  >
    <template #title>
      <div class="modal-title-row">
        <span class="modal-title-prefix">分镜脚本：</span>
        <a-input v-model:value="localTitle" class="modal-title-input" placeholder="未命名" />
      </div>
    </template>

    <div class="modal-content">
      <!-- 工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <button
            class="toolbar-btn"
            type="button"
            :disabled="!canUndo"
            title="撤销"
            @click="handleUndo"
          >
            <UndoOutlined />
            <span>撤销</span>
          </button>
          <button
            class="toolbar-btn"
            type="button"
            :disabled="!canRedo"
            title="重做"
            @click="handleRedo"
          >
            <RedoOutlined />
            <span>重做</span>
          </button>
          <button class="toolbar-btn" type="button" title="复制" @click="handleCopy">
            <CopyOutlined />
            <span>复制</span>
          </button>
          <button class="toolbar-btn" type="button" title="清空" @click="handleClear">
            <DeleteOutlined />
            <span>清空</span>
          </button>
        </div>
        <div class="toolbar-right">
          <a-button @click="showImportModal = true">
            <template #icon><FileAddOutlined /></template>
            导入文档
          </a-button>
          <a-button @click="showHistoryPanel = true">
            <template #icon><HistoryOutlined /></template>
            历史版本
          </a-button>
        </div>
      </div>

      <!-- 文本编辑器（Quill 无工具栏，存 HTML） -->
      <div class="editor-container">
        <RichTextEditor
          v-model="localContent"
          class="script-editor"
          placeholder='可直接输入分镜脚本内容，或点击右上角"导入文档"导入'
          min-height="360px"
          :max-length="10000"
          @update:model-value="handleContentChange"
        />
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="modal-footer">
      <a-button @click="handleCancel">
        <div class="text-gradient">取消</div>
      </a-button>
      <a-button type="primary" @click="handleSave">保存</a-button>
    </div>

    <!-- 历史版本侧边栏 -->
    <a-drawer v-model:open="showHistoryPanel" placement="right" :width="400">
      <template #title>
        <div class="drawer-title">
          <HistoryOutlined />
          <span>历史版本</span>
        </div>
      </template>
      <div v-if="historyVersions.length === 0" class="empty-history">
        <FileTextOutlined class="empty-icon" />
        <p>暂无历史记录</p>
      </div>
      <div v-else class="history-list">
        <div
          v-for="(version, index) in historyVersions"
          :key="version.id"
          :class="['history-item', { active: selectedHistoryId === version.id }]"
          @click="selectHistoryVersion(version)"
        >
          <div class="history-header">
            <span class="history-title">版本 {{ historyVersions.length - index }}</span>
            <span class="history-time">{{ formatTime(version.createdAt) }}</span>
          </div>
          <div class="history-preview">{{ getPreview(version.content) }}</div>
          <div class="history-actions">
            <a-button size="small" type="link" @click.stop="restoreVersion(version)">
              恢复此版本
            </a-button>
            <a-button size="small" type="link" danger @click.stop="deleteVersion(version.id)">
              删除
            </a-button>
          </div>
        </div>
      </div>
    </a-drawer>

    <!-- 导入文档弹窗 -->
    <ImportScriptModal v-model:open="showImportModal" @import="handleImport" />
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  UndoOutlined,
  RedoOutlined,
  CopyOutlined,
  DeleteOutlined,
  FileAddOutlined,
  HistoryOutlined,
  FileTextOutlined
} from '@ant-design/icons-vue'
import { message, Modal } from 'ant-design-vue'
import RichTextEditor from '~/components/common/RichTextEditor.vue'
import ImportScriptModal from './ImportScriptModal.vue'
import { htmlToPlainText, isHtmlContentEmpty } from '~/utils/htmlPlain'

interface Props {
  open: boolean
  panelTitle: string
  initialContent?: string
}

interface HistoryVersion {
  id: string
  content: string
  createdAt: string
}

const props = withDefaults(defineProps<Props>(), {
  panelTitle: '',
  initialContent: ''
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [payload: { title: string; content: string }]
}>()

const localOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v)
})

const localTitle = ref(props.panelTitle)
const localContent = ref(props.initialContent)
const showHistoryPanel = ref(false)
const showImportModal = ref(false)
const selectedHistoryId = ref<string | null>(null)

const historyStack = ref<string[]>([])
const historyIndex = ref(-1)
const maxHistorySize = 50
const historyVersions = ref<HistoryVersion[]>([])

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < historyStack.value.length - 1)

watch(
  () => props.panelTitle,
  (newVal) => {
    localTitle.value = newVal ?? ''
  },
  { immediate: true }
)

watch(
  () => props.initialContent,
  (newVal) => {
    if (localContent.value !== newVal) {
      localContent.value = newVal
      if (historyStack.value.length === 0) {
        historyStack.value = [newVal]
        historyIndex.value = 0
      }
    }
  },
  { immediate: true }
)

const handleContentChange = () => {
  if (
    historyStack.value.length === 0 ||
    historyStack.value[historyIndex.value] !== localContent.value
  ) {
    saveToHistory(localContent.value)
  }
}

const saveToHistory = (content: string) => {
  if (historyStack.value[historyIndex.value] === content) return
  historyStack.value = historyStack.value.slice(0, historyIndex.value + 1)
  historyStack.value.push(content)
  if (historyStack.value.length > maxHistorySize) {
    historyStack.value.shift()
  } else {
    historyIndex.value = historyStack.value.length - 1
  }
}

const handleUndo = () => {
  if (canUndo.value) {
    historyIndex.value--
    localContent.value = historyStack.value[historyIndex.value]
  }
}

const handleRedo = () => {
  if (canRedo.value) {
    historyIndex.value++
    localContent.value = historyStack.value[historyIndex.value]
  }
}

const handleCopy = async () => {
  if (isHtmlContentEmpty(localContent.value)) {
    message.warning('没有内容可复制')
    return
  }
  try {
    await navigator.clipboard.writeText(htmlToPlainText(localContent.value))
    message.success('已复制到剪贴板')
  } catch {
    message.error('复制失败')
  }
}

const handleClear = () => {
  if (isHtmlContentEmpty(localContent.value)) return
  Modal.confirm({
    title: '确认清空',
    content: '确定要清空全部分镜脚本内容吗？此操作不可撤销。',
    onOk: () => {
      localContent.value = ''
      saveToHistory('')
      message.success('已清空')
    }
  })
}

const selectHistoryVersion = (_version: HistoryVersion) => {
  // 仅用于高亮，恢复用 restoreVersion
}

const restoreVersion = (version: HistoryVersion) => {
  localContent.value = version.content
  saveToHistory(version.content)
  message.success('已恢复此版本')
  showHistoryPanel.value = false
}

const deleteVersion = (id: string) => {
  historyVersions.value = historyVersions.value.filter((v) => v.id !== id)
  if (selectedHistoryId.value === id) selectedHistoryId.value = null
  message.success('已删除')
}

const formatTime = (time: string) => {
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getPreview = (content: string) => {
  const plain = htmlToPlainText(content)
  if (!plain) return '空内容'
  return plain.length > 100 ? plain.substring(0, 100) + '...' : plain
}

const handleImport = (content: string) => {
  localContent.value = content
  saveToHistory(content)
  message.success('导入成功')
  showImportModal.value = false
}

const handleSave = () => {
  const title = localTitle.value?.trim() || '未命名'
  emit('save', { title, content: localContent.value })
  localOpen.value = false
}

const handleCancel = () => {
  localOpen.value = false
}
</script>

<style lang="scss" scoped>
.storyboard-script-modal :deep(.ant-modal-body) {
  padding: 0;
}

.modal-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.modal-title-prefix {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  flex-shrink: 0;
}

.modal-title-input {
  width: 0;
  min-width: 120px;
  font-size: 1.125rem;
  font-weight: 600;
}

.modal-content {
  min-height: 500px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 28px;
}

.toolbar-left {
  display: flex;
  gap: 0.5rem;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(74, 231, 253, 0.3);
  border-radius: var(--radius-md);
  background: var(--create-surface-panel, rgba(38, 50, 72, 0.92));
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--home-text, #e6edf3);
  font-size: 0.875rem;
  height: 28px;
}

.toolbar-btn:hover:not(:disabled) {
  border-color: rgba(74, 231, 253, 0.55);
  color: #4ae7fd;
  background: rgba(14, 89, 250, 0.15);
}


.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar-right {
  display: flex;
  gap: 0.75rem;
  .ant-btn {
    border: 1px solid rgba(47, 57, 73, 1) !important;
    border-radius: 8px;
    height: 28px;
    padding: 0 15px;
    background: transparent !important;
  }
}

.editor-container {
  margin-top: 0.75rem;
}

.script-editor {
  width: 100%;
  height: 48vh !important;
}

.script-editor :deep(.ql-container),
.script-editor :deep(.ql-editor) {
  height: 48vh !important;
  min-height: 48vh !important;
  max-height: 48vh !important;
  border: none !important;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 12px 0;
}

.drawer-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.empty-history {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 0;
  color: var(--gray-500);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.3;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.history-item {
  padding: 1rem;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
}

.history-item:hover {
  border-color: var(--accent-400, #4ae7fd);
  background: rgba(74, 231, 253, 0.08);
}

.history-item.active {
  border-color: var(--accent-500, #4ae7fd);
  background: rgba(74, 231, 253, 0.14);
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.history-title {
  font-weight: 600;
  color: var(--home-text, #e6edf3);
}

.history-time {
  font-size: 0.875rem;
  color: var(--home-muted, #8e97a5);
}

.history-preview {
  font-size: 0.875rem;
  color: var(--home-muted, #8e97a5);
  margin-bottom: 0.75rem;
  line-height: 1.5;
}

.history-actions {
  display: flex;
  gap: 0.5rem;
}
</style>
