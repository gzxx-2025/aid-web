<template>
  <div
    class="prompt-script-file-header"
    :class="{
      'prompt-script-file-header--no-actions': !hasActions,
      [`prompt-script-file-header--${theme}`]: true
    }"
  >
    <a-tooltip v-if="settingClickBlockedTooltip" :title="settingClickBlockedTooltip">
      <div class="scene-file-info scene-file-info--blocked">
        <img
          v-if="iconType === 'scene'"
          src="/assets/img//icon/script_gray.svg"
          class="file-icon file-icon--img"
          alt=""
        />
        <FileTextOutlined v-else class="file-icon" />
        <span class="scene-file-name">{{ fileName }}</span>
      </div>
    </a-tooltip>
    <div
      v-else
      class="scene-file-info"
      :class="{ 'scene-file-info--clickable': sceneFileClickable }"
      @click="onFileClick"
    >
      <img
        v-if="iconType === 'scene'"
        src="/assets/img//icon/script_gray.svg"
        class="file-icon file-icon--img"
        alt=""
      />
      <FileTextOutlined v-else class="file-icon" />
      <span class="scene-file-name">{{ fileName }}</span>
    </div>
    <div v-if="hasActions" class="prompt-row-actions">
      <span v-if="showReferenceButton && referenceDisplayMode === 'label'" class="ref-link-label">
        <PictureOutlined class="ref-link-label__icon" />
        参考图
      </span>
      <a-button
        v-else-if="showReferenceButton"
        type="text"
        class="ref-link-btn"
        @click="emit('importReference')"
      >
        <template #icon><PictureOutlined /></template>
        参考图
      </a-button>
      <a-button
        v-if="showGeneratePromptButton && theme === 'scene-modal'"
        class="generate-prompt-btn generate-prompt-btn--gradient"
        type="primary"
        :loading="generatePromptLoading"
        :disabled="generatePromptLoading"
        @click="emit('generatePrompt')"
      >
        <span class="text-gradient">生成提示词</span>
      </a-button>
      <a-button
        v-else-if="showGeneratePromptButton && theme === 'modal-dark'"
        class="generate-prompt-btn generate-prompt-btn--gradient"
        :loading="generatePromptLoading"
        :disabled="generatePromptLoading"
        @click="emit('generatePrompt')"
      >
        <span class="text-gradient">生成提示词</span>
      </a-button>
      <a-button
        v-else-if="showGeneratePromptButton"
        type="primary"
        class="generate-prompt-btn generate-prompt-btn--gradient"
        :loading="generatePromptLoading"
        :disabled="generatePromptLoading"
        @click="emit('generatePrompt')"
      >
        <span class="text-gradient">生成提示词</span>
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FileTextOutlined, PictureOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'

const props = withDefaults(
  defineProps<{
    fileName: string
    /** 场景图弹窗用 script 图标；分镜/视频用文件图标 */
    iconType?: 'scene' | 'file-text'
    /** 是否显示「参考图」 */
    showReferenceButton?: boolean
    /** button：可点击上传；label：仅展示文案 */
    referenceDisplayMode?: 'button' | 'label'
    /** 是否显示「生成提示词」 */
    showGeneratePromptButton?: boolean
    /** 生成提示词进行中 */
    generatePromptLoading?: boolean
    /** 左侧标题行是否可点击（打开脚本/场景设定） */
    sceneFileClickable?: boolean
    /** 非空时：标题行不可点击，悬停展示说明（如手动添加的资产无法编辑设定） */
    settingClickBlockedTooltip?: string
    /**
     * panel：分镜步骤面板浅色
     * modal-dark：编辑分镜图弹窗内右侧
     * scene-modal：编辑场景图弹窗右侧
     */
    theme?: 'panel' | 'modal-dark' | 'scene-modal'
  }>(),
  {
    iconType: 'file-text',
    showReferenceButton: true,
    referenceDisplayMode: 'button',
    showGeneratePromptButton: true,
    generatePromptLoading: false,
    sceneFileClickable: true,
    settingClickBlockedTooltip: undefined,
    theme: 'panel'
  }
)

const emit = defineEmits<{
  clickFile: []
  importReference: []
  generatePrompt: []
}>()

const hasActions = computed(() => props.showReferenceButton || props.showGeneratePromptButton)

function onFileClick() {
  if (props.sceneFileClickable) {
    emit('clickFile')
  }
}
</script>

<style scoped lang="scss">
.prompt-script-file-header {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
  align-items: stretch;
  padding: 6px 8px;
  height: 82px;
  background: rgba(18, 18, 18, 1);
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
}

.prompt-script-file-header--no-actions {
  justify-content: flex-start;
}

.prompt-script-file-header--panel.prompt-script-file-header--no-actions {
  justify-content: flex-start;
}

.prompt-script-file-header--panel .scene-file-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.prompt-script-file-header--panel .scene-file-info--clickable {
  cursor: pointer;
}

.prompt-script-file-header--panel .scene-file-info--clickable:hover .scene-file-name {
  color: var(--accent-800);
}

.prompt-script-file-header--panel .file-icon {
  font-size: 1.25rem;
  color: var(--accent-600);
  flex-shrink: 0;
}

.prompt-script-file-header--panel .scene-file-name {
  font-weight: 600;
  color: var(--accent-700);
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 编辑场景图弹窗 */
.prompt-script-file-header--scene-modal {
  padding: 8px 10px;
  border-radius: 10px;
  justify-content: space-between;
  margin-bottom: 8px;
}

.prompt-script-file-header--scene-modal.prompt-script-file-header--no-actions {
  height: auto;
  min-height: 0;
  padding: 10px 10px;
  gap: 0;
  margin-bottom: 8px;
}

.prompt-script-file-header--scene-modal .scene-file-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.prompt-script-file-header--scene-modal .scene-file-info--blocked {
  cursor: not-allowed;
  opacity: 0.85;
}

.prompt-script-file-header--scene-modal .file-icon--img {
  width: 14px;
  height: 14px;
  object-fit: contain;
  flex-shrink: 0;
}

.prompt-script-file-header--scene-modal .scene-file-name {
  font-size: 12px;
  color: #cfe5ff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prompt-row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
  width: 100%;
  margin-left: 0;
  margin-top: auto;
  height: 28px;
}

/* 仅非 outline 的生成按钮需要深色底（避免覆盖 modal-dark 的描边「生成提示词」） */
.prompt-script-file-header--panel
  .prompt-row-actions
  .generate-prompt-btn:not(.generate-prompt-btn--outline),
.prompt-script-file-header--scene-modal
  .prompt-row-actions
  .generate-prompt-btn:not(.generate-prompt-btn--outline) {
  background: rgba(18, 18, 18, 1) !important;
  border: 1px solid rgba(74, 231, 253, 0.3) !important;
}

.ref-link-btn {
  color: rgba(216, 230, 252, 0.9);
  padding-left: 0;
  font-size: 13px;
}

.ref-link-btn :deep(.anticon) {
  font-size: 14px;
}

.ref-link-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: rgba(216, 230, 252, 0.9);
  font-size: 13px;
  user-select: none;
  pointer-events: none;
}

.ref-link-label__icon {
  font-size: 14px;
}

.prompt-script-file-header--scene-modal .ref-link-label {
  font-size: 14px;
}
.generate-prompt-btn :deep(.ant-btn) {
  box-shadow: none !important;
}

/* loading 与文案同一行，避免块级子元素导致换行 */
.generate-prompt-btn {
  display: inline-flex !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  align-items: center !important;
  justify-content: center;
  white-space: nowrap;
  vertical-align: middle;

  .text-gradient {
    display: inline;
    white-space: nowrap;
    line-height: 1.2;
  }

  :deep(.ant-btn-loading-icon) {
    display: inline-flex !important;
    align-items: center;
    flex-shrink: 0;
  }
}

.prompt-script-file-header--panel .generate-prompt-btn {
  height: 34px;
  border-radius: 10px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 600;
}

.generate-prompt-btn--outline {
  height: 40px;
  border-radius: 999px;
  padding: 0 18px;
  color: #4ae7fd !important;
  font-size: 13px;
  font-weight: 500;
  background: transparent !important;
  border: 1px solid rgba(74, 231, 253, 0.65) !important;
  box-shadow: none !important;
}

.generate-prompt-btn--outline:hover,
.generate-prompt-btn--outline:active {
  background: rgba(9, 13, 20, 0.9) !important;
  border-color: rgba(74, 231, 253, 0.65) !important;
  color: #4ae7fd !important;
  box-shadow: none !important;
}
//.generate-prompt-btn--outline:focus,
//.generate-prompt-btn--outline:active {
//  background: rgba(9, 13, 20, 0.9) !important;
//  border-color: rgba(74, 231, 253, 0.65) !important;
//  color: #4ae7fd !important;
//  box-shadow: none !important;
//}
/* modal-dark：参考图 = 实心胶囊；生成提示词 = 青描边透明底（上文的 outline） */
.prompt-script-file-header--modal-dark .ref-link-btn {
  height: 40px;
  border-radius: 999px !important;
  padding: 0 16px !important;
  color: rgba(225, 239, 255, 0.95) !important;
  background: rgba(15, 45, 72, 0.95) !important;
  border: 1px solid rgba(74, 231, 253, 0.18) !important;
}

.prompt-script-file-header--modal-dark .ref-link-btn:hover {
  color: #fff !important;
  background: rgba(22, 58, 92, 1) !important;
  border-color: rgba(74, 231, 253, 0.35) !important;
}
//.prompt-script-file-header--modal-dark .ref-link-btn:focus {
//  color: #fff !important;
//  background: rgba(22, 58, 92, 1) !important;
//  border-color: rgba(74, 231, 253, 0.35) !important;
//}
.prompt-script-file-header--scene-modal .prompt-row-actions :deep(.ant-btn) {
  height: 28px;
  border-radius: 10px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: none !important;
}
</style>