<template>
  <div class="story-script create-step-story-script">
    <!-- 调试信息 -->
    <div v-if="false" style="background: red; color: white; padding: 1rem">
      组件已加载 - StoryScript Component Loaded
    </div>
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left" :class="{ 'toolbar-left--has-text': hasEditorText }">
        <button class="toolbar-btn" @click="handleUndo" :disabled="!canUndo" title="撤销">
          <UndoOutlined />
          <span>撤销</span>
        </button>
        <button class="toolbar-btn" @click="handleRedo" :disabled="!canRedo" title="重做">
          <RedoOutlined />
          <span>重做</span>
        </button>
        <button class="toolbar-btn" @click="handleCopy" title="复制">
          <CopyOutlined />
          <span>复制</span>
        </button>
        <button class="toolbar-btn" @click="handleClear" title="清空">
          <DeleteOutlined />
          <span>清空</span>
        </button>
      </div>
      <div class="toolbar-right">
        <a-button @click="showImportModal = true" class="import-btn">
          <template #icon><UploadOutlined /></template>
          导入剧本(单集)
        </a-button>
        <a-button @click="showHistoryPanel = true" class="history-btn">
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
        placeholder="请输入本集剧本内容 (建议2000字以内), 或点击右上角「导入剧本(单集)」

提示:若为全集/多集内容,请按集拆分后分别创建作品导入"
        min-height="500px"
        :max-length="10000"
        show-count
        @update:model-value="handleContentChange"
      />
    </div>

    <!-- 历史版本侧边栏 -->
    <a-drawer
      v-model:open="showHistoryPanel"
      title="历史版本"
      placement="right"
      :width="400"
      root-class-name="create-theme-drawer"
      class="history-drawer"
    >
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

    <!-- 导入剧本弹窗 -->
    <ImportScriptModal
      v-model:open="showImportModal"
      :before-script-import="beforeScriptImport"
      @import="handleImport"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  UndoOutlined,
  RedoOutlined,
  CopyOutlined,
  DeleteOutlined,
  UploadOutlined,
  HistoryOutlined,
  FileTextOutlined
} from '@ant-design/icons-vue'
import { message, Modal } from 'ant-design-vue'
import RichTextEditor from '~/components/common/RichTextEditor.vue'
import ImportScriptModal from './ImportScriptModal.vue'
import { htmlToPlainText, isHtmlContentEmpty } from '~/utils/htmlPlain'
import { useStoryScriptAutoSave } from '~/composables/useStoryScriptAutoSave'

interface Props {
  modelValue: string
  description?: string
}

interface HistoryVersion {
  id: string
  content: string
  createdAt: string
}

const props = withDefaults(defineProps<Props>(), {
  description: '编写你的精彩故事',
  modelValue: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const localContent = ref(props.modelValue)
const showHistoryPanel = ref(false)
const showImportModal = ref(false)
const selectedHistoryId = ref<string | null>(null)

// 撤销/重做历史
const historyStack = ref<string[]>([])
const historyIndex = ref(-1)
const maxHistorySize = 50

// 历史版本列表
const historyVersions = ref<HistoryVersion[]>([])

// 计算是否可以撤销/重做
const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < historyStack.value.length - 1)

/** 输入框有非空内容时，左侧工具栏图标使用主题青色 */
const hasEditorText = computed(() => !isHtmlContentEmpty(localContent.value))

/** 30 秒无编辑且内容与已同步版本不一致时静默保存 */
useStoryScriptAutoSave(localContent)

// 监听内容变化，保存到历史栈
watch(
  () => props.modelValue,
  (newVal) => {
    if (localContent.value !== newVal) {
      localContent.value = newVal
      // 初始化时不保存到历史栈
      if (historyStack.value.length === 0) {
        historyStack.value = [newVal]
        historyIndex.value = 0
      }
    }
  },
  { immediate: true }
)

// 内容变化处理
const handleContentChange = () => {
  emit('update:modelValue', localContent.value)
  // 延迟保存到历史栈，避免频繁触发
  if (
    historyStack.value.length === 0 ||
    historyStack.value[historyIndex.value] !== localContent.value
  ) {
    saveToHistory(localContent.value)
  }
}

// 保存到历史栈
const saveToHistory = (content: string) => {
  // 如果内容与当前历史栈顶部相同，不保存
  if (historyStack.value[historyIndex.value] === content) {
    return
  }

  // 删除当前位置之后的历史
  historyStack.value = historyStack.value.slice(0, historyIndex.value + 1)

  // 添加新内容
  historyStack.value.push(content)

  // 限制历史栈大小
  if (historyStack.value.length > maxHistorySize) {
    historyStack.value.shift()
  } else {
    historyIndex.value = historyStack.value.length - 1
  }
}

// 撤销
const handleUndo = () => {
  if (canUndo.value) {
    historyIndex.value--
    const content = historyStack.value[historyIndex.value]
    localContent.value = content
    emit('update:modelValue', content)
  }
}

// 重做
const handleRedo = () => {
  if (canRedo.value) {
    historyIndex.value++
    const content = historyStack.value[historyIndex.value]
    localContent.value = content
    emit('update:modelValue', content)
  }
}

// 复制
const handleCopy = async () => {
  if (isHtmlContentEmpty(localContent.value)) {
    message.warning('没有内容可复制')
    return
  }

  try {
    await navigator.clipboard.writeText(htmlToPlainText(localContent.value))
    message.success('已复制到剪贴板')
  } catch (err) {
    message.error('复制失败')
  }
}

// 清空
const handleClear = () => {
  if (isHtmlContentEmpty(localContent.value)) {
    return
  }

  Modal.confirm({
    title: '确认清空',
    content: '确定要清空所有内容吗？此操作不可撤销。',
    onOk: () => {
      localContent.value = ''
      emit('update:modelValue', '')
      saveToHistory('')
      message.success('已清空')
    }
  })
}

// 选择历史版本
const selectHistoryVersion = (version: HistoryVersion) => {
  selectedHistoryId.value = version.id
}

// 恢复版本
const restoreVersion = (version: HistoryVersion) => {
  localContent.value = version.content
  emit('update:modelValue', version.content)
  saveToHistory(version.content)
  message.success('已恢复此版本')
  showHistoryPanel.value = false
}

// 删除版本
const deleteVersion = (id: string) => {
  historyVersions.value = historyVersions.value.filter((v) => v.id !== id)
  if (selectedHistoryId.value === id) {
    selectedHistoryId.value = null
  }
  message.success('已删除')
}

// 格式化时间
const formatTime = (time: string) => {
  const date = new Date(time)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 获取预览文本
const getPreview = (content: string) => {
  const plain = htmlToPlainText(content)
  if (!plain) return '空内容'
  return plain.length > 100 ? plain.substring(0, 100) + '...' : plain
}

// 导入剧本前确认覆盖
function beforeScriptImport(): Promise<boolean> {
  if (isHtmlContentEmpty(localContent.value)) return Promise.resolve(true)
  return new Promise((resolve) => {
    Modal.confirm({
      title: '覆盖确认',
      content: '确定要覆盖当前剧本内容吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => resolve(false)
    })
  })
}

// 导入剧本
const handleImport = (content: string) => {
  localContent.value = content
  emit('update:modelValue', content)
  saveToHistory(content)
  message.success('导入成功')
  showImportModal.value = false
}

// 保存历史版本
const saveVersion = () => {
  if (isHtmlContentEmpty(localContent.value)) {
    message.warning('内容为空，无法保存版本')
    return
  }

  const version: HistoryVersion = {
    id: `version-${Date.now()}`,
    content: localContent.value,
    createdAt: new Date().toISOString()
  }

  historyVersions.value.unshift(version)
  // 限制历史版本数量
  if (historyVersions.value.length > 20) {
    historyVersions.value = historyVersions.value.slice(0, 20)
  }

  message.success('已保存为历史版本')
}
</script>

<style lang="scss" scoped>
/* 与首页深蓝青主题一致（创作页右侧主内容区） */
.story-script {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 600px;
  background: transparent;
  color: #e6edf3;
}

.content-header {
  margin-bottom: 1.5rem;
}

.step-description-text {
  color: #8e97a5;
  font-size: 1rem;
  line-height: 1.6;
  margin: 0;
  font-weight: 500;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.toolbar-left {
  display: flex;
  gap: 0.5rem;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 4px 10px;
  border: 1px solid #2f3949;
  border-radius: var(--radius-m);
  background: none;
  color: #e6edf3;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.toolbar-btn:hover:not(:disabled) {
  border-color: rgba(74, 231, 253, 0.55);
  color: #4ae7fd;
  // background: rgba(14, 89, 250, 0.18);
}

.toolbar-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* 有正文时：撤销/重做/复制/清空 的图标为主色（仅图标，不影响右侧导入/历史按钮） */
.toolbar-right {
  display: flex;
  gap: 0.75rem;
  .import-btn,
  .history-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #2f3949 !important;
    background: transparent !important;
    font-size: 14px;
  }
}

.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 500px;
  width: 100%;
  overflow: visible;
}

.script-editor {
  width: 100%;
  font-size: 1rem;
  line-height: 1.8;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

.script-editor :deep(.ql-container) {
  min-height: 500px;
  font-size: 1rem;
  border: none !important;
}

.script-editor :deep(.ql-editor) {
  min-height: 82vh;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  line-height: 1.8;
  padding: 1rem;
}

/* 历史版本抽屉标题插槽 */
.drawer-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: #fff;
}

.empty-history {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  color: rgba(74, 231, 253, 0.25);
  margin-bottom: 1rem;
}

.empty-history p {
  color: #8e97a5;
  font-size: 1rem;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.history-item {
  padding: 1rem;
  border: 1px solid rgba(74, 231, 253, 0.15);
  border-radius: var(--radius-lg);
  background: rgba(12, 16, 24, 0.65);
  cursor: pointer;
  transition: all 0.2s ease;
}

.history-item:hover {
  border-color: rgba(74, 231, 253, 0.4);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
}

.history-item.active {
  border-color: rgba(0, 171, 216, 0.55);
  background: rgba(14, 89, 250, 0.2);
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.history-title {
  font-weight: 600;
  color: #fff;
  font-size: 0.9375rem;
}

.history-time {
  font-size: 0.8125rem;
  color: #8e97a5;
}

.history-preview {
  font-size: 0.875rem;
  color: #c9d1d9;
  line-height: 1.6;
  margin-bottom: 0.75rem;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.history-actions {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(74, 231, 253, 0.1);
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .toolbar-left {
    flex-wrap: wrap;
  }

  .toolbar-right {
    flex-direction: column;
  }

  .import-btn,
  .history-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
