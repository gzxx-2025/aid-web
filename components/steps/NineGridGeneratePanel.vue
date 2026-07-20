<template>
  <div class="nine-grid-generate-panel">
    <div class="nine-grid-section">
      <div class="nine-grid-section__label">
        <span class="nine-grid-dot" />
        参考图
      </div>
      <p class="nine-grid-hint">使用画布当前选中图片作为九宫格基准图</p>
      <div class="nine-grid-reference">
        <img
          v-if="referenceImageUrl"
          :src="referenceImageUrl"
          alt="参考图"
          class="nine-grid-reference__img"
        />
        <div v-else class="nine-grid-reference__empty">
          <PictureOutlined />
          <span>请先在左侧选择一张分镜图</span>
        </div>
      </div>
    </div>

    <div class="nine-grid-section">
      <div class="nine-grid-section__head">
        <div class="nine-grid-section__label">
          <span class="nine-grid-dot" />
          九格机位提示词
        </div>
        <button type="button" class="nine-grid-reset-btn" @click="resetAngles">
          恢复默认
        </button>
      </div>
      <p class="nine-grid-hint">每格对应 3×3 拼图中的一个机位，共 9 条，不可为空</p>
      <div class="nine-grid-cells">
        <div
          v-for="(label, idx) in cellLabels"
          :key="idx"
          class="nine-grid-cell"
        >
          <label class="nine-grid-cell__label">{{ label }}</label>
          <a-textarea
            :value="angles[idx]"
            :rows="2"
            :maxlength="200"
            class="nine-grid-cell__input"
            :placeholder="defaultAngles[idx]"
            @update:value="onAngleInput(idx, $event)"
          />
        </div>
      </div>
    </div>

    <GenerateModelConfigBlock
      :aspect-ratio="aspectRatio"
      :count="1"
      :quality="'2k'"
      :aspect-ratio-options="aspectRatioOptions"
      :count-options="[]"
      :quality-options="[]"
      select-class="setting-select"
      density="storyboard"
      :show-quality-3k="false"
      :show-action="false"
      :show-title="true"
      title="模型配置"
      @update:aspect-ratio="$emit('update:aspectRatio', $event)"
    >
      <template #model>
        <ModelSelectDropdown
          :value="modelValue"
          :options="modelOptions"
          :expanded="modelExpanded"
          @toggle="$emit('update:modelExpanded', !modelExpanded)"
          @close="$emit('update:modelExpanded', false)"
          @select="$emit('select-model', $event)"
        />
      </template>
    </GenerateModelConfigBlock>
  </div>
</template>

<script setup lang="ts">
import { PictureOutlined } from '@ant-design/icons-vue'
import GenerateModelConfigBlock from './GenerateModelConfigBlock.vue'
import ModelSelectDropdown, { type ModelOption } from './ModelSelectDropdown.vue'
import type { SelectOption } from '~/utils/modelCapability'
import {
  createDefaultNineGridAngles,
  DEFAULT_NINE_GRID_ANGLE_PROMPTS,
  NINE_GRID_CELL_LABELS
} from '~/utils/nineGridCameraAngles'

interface Props {
  referenceImageUrl: string
  angles: string[]
  modelValue: ModelOption
  modelOptions: ModelOption[]
  modelExpanded: boolean
  aspectRatio: string
  aspectRatioOptions?: SelectOption<string>[]
}

const props = withDefaults(defineProps<Props>(), {
  aspectRatioOptions: undefined
})

const emit = defineEmits<{
  'update:angles': [value: string[]]
  'update:modelExpanded': [value: boolean]
  'select-model': [model: ModelOption]
  'update:aspectRatio': [value: string]
}>()

const cellLabels = NINE_GRID_CELL_LABELS
const defaultAngles = [...DEFAULT_NINE_GRID_ANGLE_PROMPTS]

function onAngleInput(index: number, value: string) {
  const next = [...props.angles]
  while (next.length < 9) next.push('')
  next[index] = value
  emit('update:angles', next)
}

function resetAngles() {
  emit('update:angles', createDefaultNineGridAngles())
}
</script>

<style scoped lang="scss">
.nine-grid-generate-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.nine-grid-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nine-grid-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.nine-grid-section__label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(225, 239, 255, 0.92);
}

.nine-grid-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ae7fd;
  flex-shrink: 0;
}

.nine-grid-hint {
  margin: 0;
  font-size: 12px;
  color: rgba(188, 205, 228, 0.55);
  line-height: 1.45;
}

.nine-grid-reset-btn {
  border: 0;
  background: transparent;
  color: rgba(74, 231, 253, 0.85);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  transition: color 0.2s ease, background 0.2s ease;

  &:hover {
    color: #4ae7fd;
    background: rgba(74, 231, 253, 0.1);
  }
}

.nine-grid-reference {
  border: 1px solid rgba(128, 154, 188, 0.22);
  border-radius: 12px;
  background: rgba(17, 22, 33, 0.75);
  overflow: hidden;
  min-height: 88px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nine-grid-reference__img {
  width: 100%;
  max-height: 120px;
  object-fit: contain;
  display: block;
}

.nine-grid-reference__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  color: rgba(188, 205, 228, 0.45);
  font-size: 12px;

  :deep(.anticon) {
    font-size: 24px;
  }
}

.nine-grid-cells {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.nine-grid-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nine-grid-cell__label {
  font-size: 12px;
  color: rgba(74, 231, 253, 0.9);
  font-weight: 500;
}

.nine-grid-cell__input {
  :deep(textarea) {
    background: rgba(8, 12, 20, 0.9) !important;
    border: 1px solid rgba(78, 94, 122, 0.42) !important;
    border-radius: 8px !important;
    color: rgba(225, 239, 255, 0.92) !important;
    font-size: 12px;
    resize: none;

    &::placeholder {
      color: rgba(188, 205, 228, 0.35);
    }

    &:hover,
    &:focus {
      border-color: rgba(74, 231, 253, 0.45) !important;
    }
  }
}

.nine-grid-generate-panel :deep(.generate-model-config-block) {
  margin-top: 4px;
}

.nine-grid-generate-panel :deep(.generate-settings-params .setting-item:nth-child(2)),
.nine-grid-generate-panel :deep(.generate-settings-params .setting-item:nth-child(3)) {
  display: none;
}
</style>
