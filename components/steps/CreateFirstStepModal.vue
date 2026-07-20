<template>
  <a-modal
    :open="open"
    :footer="null"
    :closable="false"
    :width="1100"
    wrap-class-name="create-flow-modal create-first-step-wrap"
    class="create-first-step-modal"
    @cancel="emit('update:open', false)"
  >
    <div class="modal-shell">
      <button
        class="close-btn"
        type="button"
        :class="{ 'is-disabled': confirmLoading }"
        @click="!confirmLoading && emit('update:open', false)"
      >
        <CloseOutlined />
      </button>

      <div class="modal-title">
        <ModalTitleWatermark :title="modalTitleText" watermark="NEW" />
      </div>

      <CreateFirstStepFormBody
        :open="open"
        :flow-edit-mode="flowEditMode"
        :project-type-locked="projectTypeLocked"
        :sync-project-type-from-parent="syncProjectTypeFromParent"
        :title="title"
        :project-type="projectType"
        :aspect-ratio="aspectRatio"
        :script-type="scriptType"
        :model-strategy="modelStrategy"
        :creation-mode="creationMode"
        :model-value="modelValue"
        class="modal-body"
        @update:title="emit('update:title', $event)"
        @update:project-type="emit('update:projectType', $event)"
        @update:aspect-ratio="emit('update:aspectRatio', $event)"
        @update:script-type="emit('update:scriptType', $event)"
        @update:model-strategy="emit('update:modelStrategy', $event)"
        @update:creation-mode="emit('update:creationMode', $event)"
        @update:model-value="emit('update:modelValue', $event)"
      />

      <div class="modal-actions">
        <button
          type="button"
          class="btn btn-secondary"
          :class="{ 'is-disabled': confirmLoading }"
          @click="!confirmLoading && emit('update:open', false)"
        >
          <div class="text-gradient">取消</div>
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="confirmLoading"
          @click="onConfirmClick"
        >
          <LoadingOutlined v-if="confirmLoading" spin class="btn-loading-icon" />
          <span>{{ confirmLoading ? confirmLoadingLabel : confirmButtonLabel }}</span>
        </button>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { CloseOutlined, LoadingOutlined } from '@ant-design/icons-vue'
import CreateFirstStepFormBody from '~/components/steps/CreateFirstStepFormBody.vue'
import ModalTitleWatermark from '~/components/ModalTitleWatermark.vue'
import type { GlobalSettingData } from '~/types'
import { computed } from 'vue'

type RatioValue = '16:9' | '9:16' | '4:3' | '3:4' | '1:1' | '21:9'
type ProjectTypeValue = 'movie' | 'series'
type ScriptTypeValue = GlobalSettingData['scriptType']
type StrategyValue = GlobalSettingData['modelStrategy']
type CreationModeValue = GlobalSettingData['creationMode']

interface Props {
  open: boolean
  title: string
  projectType: ProjectTypeValue
  aspectRatio: RatioValue
  scriptType: ScriptTypeValue
  modelStrategy: StrategyValue
  creationMode: CreationModeValue
  modelValue: GlobalSettingData
  confirmLoading?: boolean
  flowEditMode?: boolean
  projectTypeLocked?: boolean
  syncProjectTypeFromParent?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  confirmLoading: false,
  flowEditMode: false,
  projectTypeLocked: false,
  syncProjectTypeFromParent: false
})

const confirmButtonLabel = computed(() => (props.flowEditMode ? '保存' : '创建作品'))
const confirmLoadingLabel = computed(() => (props.flowEditMode ? '保存中…' : '创建中…'))
const modalTitleText = computed(() => (props.flowEditMode ? '全局设定' : '新建项目'))

function onConfirmClick() {
  if (props.confirmLoading) return
  emit('confirm')
}

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:title': [value: string]
  'update:projectType': [value: ProjectTypeValue]
  'update:aspectRatio': [value: RatioValue]
  'update:scriptType': [value: ScriptTypeValue]
  'update:modelStrategy': [value: StrategyValue]
  'update:creationMode': [value: CreationModeValue]
  'update:modelValue': [value: GlobalSettingData]
  confirm: []
}>()
</script>

<style lang="scss" scoped>
:global(.create-first-step-wrap .ant-modal-content) {
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
}

:global(.create-first-step-wrap .ant-modal-body) {
  padding: 0 !important;
}

.modal-shell {
  position: relative;
  width: 1100px;
  height: 698px;
  background: #191a1d;
  border-radius: 8px;
  color: #fff;
  overflow: hidden;
}

.close-btn {
  position: absolute;
  top: 22px;
  right: 24px;
  border: none;
  background: transparent;
  color: #fff;
  cursor: pointer;
  z-index: 2;
  font-size: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;

  &.is-disabled {
    opacity: 0.45;
    pointer-events: none;
    cursor: not-allowed;
  }
}

.modal-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px 16px 0;
  height: 54px;
  box-sizing: border-box;
  line-height: 54px;
  background: url('../../assets/img/createProcess/NEW-bg.svg') no-repeat center;
}

.modal-body {
  padding: 16px 21px 0;
  box-sizing: border-box;
  height: 560px;
}

.modal-body :deep(.left-panel),
.modal-body :deep(.right-panel) {
  height: 100%;
  border-color: rgba(74, 231, 253, 0.3);
  background: #111621;
  border-radius: 8px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  position: absolute;
  right: 0;
  bottom: 0;
}

.btn {
  height: 40px;
  border-radius: 10px;
  padding: 0 24px;
  border: 1px solid rgba(74, 231, 253, 0.3);
  cursor: pointer;
  font-size: 16px;
  line-height: 22px;
}

.btn-secondary {
  background: #121212;
  color: #fff;

  &.is-disabled {
    opacity: 0.45;
    pointer-events: none;
    cursor: not-allowed;
  }
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(270deg, #0e59fa 0%, #00abd8 100%);
  color: #fff;
  border: none;

  &:disabled {
    opacity: 0.85;
    cursor: not-allowed;
  }
}

.btn-loading-icon {
  font-size: 16px;
}
</style>
