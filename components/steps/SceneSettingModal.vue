<template>
  <a-modal
    v-model:open="localOpen"
    :width="1000"
    :footer="null"
    :class="[
      'scene-setting-modal',
      { 'scene-setting-modal--structured': usesStructuredSettingLock }
    ]"
    wrap-class-name="create-flow-modal"
    @cancel="handleCancel"
  >
    <template #title>
      <div class="modal-title-row" @mousedown.stop>
        <span v-if="titlePrefix" class="modal-title-prefix">{{ titlePrefix }}</span>
        <a-input
          v-if="editingTitleField"
          ref="titleInputRef"
          v-model:value="editingNameSuffix"
          class="modal-title-input"
          size="small"
          :bordered="false"
          :placeholder="titleInputPlaceholder"
          @blur="handleTitleSuffixCommit"
          @press-enter.prevent="handleTitleSuffixCommit"
          @click.stop
        />
        <span
          v-else
          class="modal-title-editable"
          role="button"
          tabindex="0"
          :title="titleSuffixDisplay || '点击修改名称'"
          @click.stop="startTitleEdit"
          @keydown.enter.prevent="startTitleEdit"
        >
          {{ titleSuffixDisplay || '（未命名）' }}
        </span>
      </div>
    </template>

    <div class="modal-content">
      <!-- 工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
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
          :class="[
            'script-editor',
            { 'script-editor--structured-setting': usesStructuredSettingLock }
          ]"
          placeholder='可直接输入,或点击右上角"导入文档"按钮导入'
          min-height="360px"
          :max-length="10000"
          :lock-character-setting-keys="usesStructuredSettingLock"
          @update:model-value="handleContentChange"
        />
      </div>

      <p v-if="settingWarmTip" class="setting-warm-tip" role="note">
        {{ settingWarmTip }}
      </p>
    </div>

    <!-- 底部操作栏 -->
    <div class="modal-footer">
      <a-button @click="handleCancel">
        <div class="text-gradient">取消</div>
      </a-button>
      <a-button v-if="showSceneDualSave" @click="handleSaveOnly">
        <div class="text-gradient">仅保存</div>
      </a-button>
      <a-button
        v-if="showSceneDualSave"
        style="font-weight: 300"
        type="primary"
        @click="handleSaveAndUpdate"
      >
        保存并更新场景图
      </a-button>
      <a-button v-else type="primary" style="font-weight: 300" @click="handleSaveOnly">
        {{ primarySyncLabel }}
      </a-button>
    </div>

    <!-- 历史版本侧边栏 -->
    <a-drawer v-model:open="showHistoryPanel" title="历史版本" placement="right" :width="400">
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
import { ref, computed, watch, nextTick } from 'vue'
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
import {
  decorateCharacterSettingHtml,
  decoratePropSettingHtml,
  decorateSceneSettingHtml,
  getCharacterSettingValidationError,
  getPropSettingValidationError,
  getSceneSettingValidationError
} from '~/utils/characterSettingProfile'

interface Props {
  open: boolean
  /** 资产展示名（场景名 / 角色名 / 道具名） */
  sceneName: string
  initialContent?: string
  /** 设定类型：决定标题与主按钮文案；场景保留「仅保存 + 保存并更新场景图」双操作 */
  settingVariant?: 'scene' | 'character' | 'prop'
}

interface HistoryVersion {
  id: string
  content: string
  createdAt: string
}

const props = withDefaults(defineProps<Props>(), {
  initialContent: '',
  settingVariant: 'scene'
})

function getAssetTitlePrefix(fullName: string, variant: 'scene' | 'character' | 'prop'): string {
  const m =
    variant === 'scene'
      ? fullName.match(/^(场景\d+):/)
      : variant === 'character'
        ? fullName.match(/^(角色\d+):/)
        : fullName.match(/^(道具\d+):/)
  return m ? m[1] + ':' : ''
}

function getAssetTitleSuffix(fullName: string, variant: 'scene' | 'character' | 'prop'): string {
  const re =
    variant === 'scene'
      ? /^场景\d+:\s*(.+)$/
      : variant === 'character'
        ? /^角色\d+:\s*(.+)$/
        : /^道具\d+:\s*(.+)$/
  const m = fullName.match(re)
  return m ? m[1] : fullName
}

function buildFullDisplayName(prefix: string, suffixTrimmed: string): string {
  if (!suffixTrimmed) return ''
  return prefix ? `${prefix} ${suffixTrimmed}` : suffixTrimmed
}

const titlePrefix = computed(() =>
  getAssetTitlePrefix((props.sceneName || '').trim(), props.settingVariant)
)

const titleInputPlaceholder = computed(() => {
  const v = props.settingVariant
  const label = v === 'scene' ? '场景' : v === 'character' ? '角色' : '道具'
  return `${label}名称`
})

const editingNameSuffix = ref('')

const resolvedFullAssetName = computed(() =>
  buildFullDisplayName(titlePrefix.value, (editingNameSuffix.value || '').trim())
)

/** 与列表一致：未编辑时展示从父级同步的后缀文案 */
const titleSuffixDisplay = computed(() =>
  getAssetTitleSuffix((props.sceneName || '').trim(), props.settingVariant)
)

const editingTitleField = ref(false)
const titleInputRef = ref<{ $el?: HTMLElement } | null>(null)

function startTitleEdit() {
  editingNameSuffix.value = titleSuffixDisplay.value
  editingTitleField.value = true
  nextTick(() => {
    const root = titleInputRef.value?.$el
    const el = root?.querySelector?.('input') as HTMLInputElement | undefined
    el?.focus()
    el?.select?.()
  })
}

function handleTitleSuffixCommit() {
  const full = resolvedFullAssetName.value
  const current = (props.sceneName || '').trim()
  editingTitleField.value = false
  if (!full) {
    message.warning('请填写名称')
    editingNameSuffix.value = getAssetTitleSuffix(current, props.settingVariant)
    return
  }
  if (full === current) {
    editingNameSuffix.value = getAssetTitleSuffix(current, props.settingVariant)
    return
  }
  emit('sync-title', full)
}

const showSceneDualSave = computed(() => props.settingVariant === 'scene')

const primarySyncLabel = computed(() =>
  props.settingVariant === 'character' ? '保存并同步角色设定' : '保存并同步道具设定'
)

/** 场景 / 角色 / 道具：小节标题转 Embed，禁止删改标题行 */
const usesStructuredSettingLock = computed(
  () =>
    props.settingVariant === 'character' ||
    props.settingVariant === 'scene' ||
    props.settingVariant === 'prop'
)

const settingWarmTip = computed(() => {
  if (props.settingVariant === 'character') {
    return '小节标题（角色介绍、基本信息、视觉关键词、性格标签、推荐色系、主要识别特征）请勿删除或修改'
  }
  if (props.settingVariant === 'scene') {
    return '小节标题（概要、场景视觉描述、角色可落位、人群）请勿删除或修改；角色可落位每行一条槽位；人群须写「有人群」或「无人群」，无人群时说明可留空。'
  }
  if (props.settingVariant === 'prop') {
    return '小节标题（道具概要、道具视觉描述）请勿删除或修改；概要为人读简介，视觉描述供生成配图。'
  }
  return ''
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  /** 标题失焦/回车：与列表改名将调用的接口一致，由父级调用 userAssetRpsUpdateMain({ name }) */
  'sync-title': [assetDisplayName: string]
  save: [content: string]
  'save-and-update': [content: string]
}>()

const localOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v)
})

const localContent = ref(props.initialContent)
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

// 监听初始内容变化
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

/** 打开/关闭设定弹窗 */
watch(localOpen, (open) => {
  if (!open) {
    editingTitleField.value = false
    return
  }
  editingTitleField.value = false
  editingNameSuffix.value = getAssetTitleSuffix((props.sceneName || '').trim(), props.settingVariant)
  nextTick(() => {
    const raw = localContent.value || ''
    let decorated = raw
    if (props.settingVariant === 'character') decorated = decorateCharacterSettingHtml(raw)
    else if (props.settingVariant === 'scene') decorated = decorateSceneSettingHtml(raw)
    else if (props.settingVariant === 'prop') decorated = decoratePropSettingHtml(raw)
    if (decorated !== raw) {
      localContent.value = decorated
      saveToHistory(decorated)
    }
  })
})

// 内容变化处理
const handleContentChange = () => {
  if (
    historyStack.value.length === 0 ||
    historyStack.value[historyIndex.value] !== localContent.value
  ) {
    saveToHistory(localContent.value)
  }
}

// 保存到历史栈
const saveToHistory = (content: string) => {
  if (historyStack.value[historyIndex.value] === content) {
    return
  }

  historyStack.value = historyStack.value.slice(0, historyIndex.value + 1)
  historyStack.value.push(content)

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
  }
}

// 重做
const handleRedo = () => {
  if (canRedo.value) {
    historyIndex.value++
    const content = historyStack.value[historyIndex.value]
    localContent.value = content
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

// 导入剧本
const handleImport = (content: string) => {
  localContent.value = content
  saveToHistory(content)
  message.success('导入成功')
  showImportModal.value = false
}

function validateBeforeSave(): boolean {
  const displayName = (props.sceneName || '').trim()
  if (!displayName) {
    message.warning('请填写名称')
    return false
  }
  if (props.settingVariant === 'character') {
    const err = getCharacterSettingValidationError(localContent.value, displayName)
    if (err) {
      message.warning(err)
      return false
    }
  } else if (props.settingVariant === 'scene') {
    const err = getSceneSettingValidationError(localContent.value, displayName)
    if (err) {
      message.warning(err)
      return false
    }
  } else if (props.settingVariant === 'prop') {
    const err = getPropSettingValidationError(localContent.value, displayName)
    if (err) {
      message.warning(err)
      return false
    }
  }
  return true
}

// 仅保存
const handleSaveOnly = () => {
  if (!validateBeforeSave()) return
  emit('save', localContent.value)
}

// 保存并更新场景图
const handleSaveAndUpdate = () => {
  if (!validateBeforeSave()) return
  emit('save-and-update', localContent.value)
}

// 取消
const handleCancel = () => {
  localOpen.value = false
}
</script>

<style lang="scss" scoped>
.scene-setting-modal :deep(.ant-modal-body) {
  padding: 0;
}

.modal-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  min-width: 0;
  padding-right: 2rem;
  font-size: 1.0625rem;
  line-height: 1.375;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
}

.modal-title-prefix {
  font-size: inherit;
  font-weight: inherit;
  color: var(--accent-400, #4ae7fd);
  flex-shrink: 0;
}

/* 与列表 .scene-card-title-editable 一致：悬停高亮，点击进入输入 */
.modal-title-editable {
  font-size: inherit;
  font-weight: inherit;
  color: inherit;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  min-width: 0;
  max-width: 420px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.modal-title-editable:hover {
  background: rgba(14, 89, 250, 0.12);
  color: var(--home-cyan, #4ae7fd);
}

.modal-title-input {
  flex: 1;
  min-width: 120px;
  max-width: 420px;
  font-size: inherit;
}

.modal-title-input :deep(.ant-input) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0.25rem 0.5rem !important;
  margin: 0 !important;
  color: inherit !important;
  font-size: inherit !important;
  font-weight: inherit !important;
  line-height: inherit !important;
  height: auto !important;
  min-height: 0 !important;
}

.modal-title-input :deep(.ant-input:focus),
.modal-title-input :deep(.ant-input-focused) {
  border: none !important;
  box-shadow: none !important;
  outline: none;
}

.modal-title-input :deep(.ant-input::placeholder) {
  color: var(--home-muted, #8e97a5);
}

.modal-content {
  min-height: 500px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
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
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  background: var(--create-surface-panel);
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--home-text, #e6edf3);
  font-size: 0.875rem;
}

.toolbar-btn:hover:not(:disabled) {
  border-color: var(--accent-400, #4ae7fd);
  color: var(--accent-400, #4ae7fd);
  background: rgba(74, 231, 253, 0.1);
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
  }
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
}

/* 结构化设定：小节标题 strong 主色（与锁定区视觉一致） */
.scene-setting-modal--structured .script-editor--structured-setting :deep(.ql-editor strong) {
  color: #4ae7fd !important;
}

.setting-warm-tip {
  margin: 10px 0 0;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(74, 231, 253, 0.45);
  background: rgba(74, 231, 253, 0.1);
  color: #4ae7fd;
  font-size: 13px;
  line-height: 1.55;
  font-weight: 500;
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
