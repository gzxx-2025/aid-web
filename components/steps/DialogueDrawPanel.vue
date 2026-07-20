<template>
  <div class="dialogue-draw-panel create-modal-tab-panel" :data-source-type="sourceType">
    <div class="create-modal-tab-chrome dialogue-draw-panel__chrome">
      <div class="dialogue-upload-strip">
        <div
          v-for="(img, idx) in sourceImages"
          :key="`${img.url}-${idx}`"
          class="dialogue-upload-thumb"
        >
          <img :src="img.url" :alt="img.title || `参考图${idx + 1}`" />
          <button
            type="button"
            class="dialogue-upload-thumb__remove"
            @click.stop="$emit('remove-source-image', idx)"
          >
            <DeleteOutlined />
          </button>
        </div>
        <button
          v-if="!maxSourceCount || sourceImages.length < maxSourceCount"
          type="button"
          class="dialogue-upload-thumb dialogue-upload-thumb--adder"
          @click="$emit('open-source-picker')"
        >
          <PlusOutlined />
        </button>
        <span v-if="maxSourceCount === 1" class="dialogue-upload-empty-hint"
          >仅支持 1 张参考图</span
        >
      </div>
    </div>

    <div class="create-modal-prompt-shell">
      <RichTextEditor
        :model-value="instructionHtml"
        class="dialogue-instruction"
        placeholder="请输入修改要求，例如：把画面改成夕阳氛围、人物表情更开心、增加气氛光效等"
        :max-length="2000"
        @update:model-value="$emit('update:instructionHtml', $event)"
      />
    </div>

    <GenerateModelConfigBlock
      :aspect-ratio="aspectRatio"
      :count="count"
      :quality="quality"
      :aspect-ratio-options="aspectRatioOptions"
      :count-options="countOptions"
      :quality-options="qualityOptions"
      select-class="setting-select"
      density="scene"
      :show-quality-3k="true"
      :show-action="false"
      @update:aspect-ratio="$emit('update:aspectRatio', $event)"
      @update:count="$emit('update:count', $event)"
      @update:quality="$emit('update:quality', $event)"
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
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'
import RichTextEditor from '~/components/common/RichTextEditor.vue'
import GenerateModelConfigBlock from './GenerateModelConfigBlock.vue'
import ModelSelectDropdown, { type ModelOption } from './ModelSelectDropdown.vue'
import type { SelectOption } from '~/utils/modelCapability'

type DialogueSourceType = 'storyboard' | 'asset'
type DialogueSourceImage = { url: string; title?: string }

interface Props {
  sourceType: DialogueSourceType
  sourceImages: DialogueSourceImage[]
  instructionHtml: string
  modelValue: ModelOption
  modelOptions: ModelOption[]
  modelExpanded: boolean
  aspectRatio: string
  count: number
  quality: string
  aspectRatioOptions?: SelectOption<string>[]
  countOptions?: SelectOption<number>[]
  qualityOptions?: SelectOption<string>[]
  /** 参考图上限；分镜对话作图接口仅允许 1 张 */
  maxSourceCount?: number
}

withDefaults(defineProps<Props>(), {
  aspectRatioOptions: undefined,
  countOptions: undefined,
  qualityOptions: undefined,
  maxSourceCount: undefined
})

defineEmits<{
  'remove-source-image': [index: number]
  'open-source-picker': []
  'update:instructionHtml': [value: string]
  'update:modelExpanded': [value: boolean]
  'select-model': [model: ModelOption]
  'update:aspectRatio': [value: string]
  'update:count': [value: number]
  'update:quality': [value: string]
}>()
</script>

<style scoped lang="scss">
.dialogue-draw-panel {
  width: 100%;
  min-height: 0;
}

.dialogue-upload-strip {
  width: 100%;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-height: 64px;
  padding: 10px;
  border-radius: 12px;
  background: #121212;
}

.dialogue-upload-thumb {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid rgba(128, 154, 188, 0.28);
  background: rgba(8, 12, 20, 0.9);
  flex-shrink: 0;
}

.dialogue-upload-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dialogue-upload-thumb__remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 77, 79, 0.95);
  color: #fff;
  cursor: pointer;
  font-size: 10px;
  line-height: 1;
  opacity: 0;
  transform: scale(0.9);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  z-index: 2;
}

.dialogue-upload-thumb:hover .dialogue-upload-thumb__remove {
  opacity: 1;
  transform: scale(1);
}

.dialogue-upload-thumb--adder {
  border: 1px dashed rgba(188, 205, 228, 0.6);
  background: transparent;
  color: rgba(225, 239, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.dialogue-upload-thumb--adder:hover {
  border-color: rgba(74, 231, 253, 0.85);
  color: rgba(74, 231, 253, 1);
}

.dialogue-upload-empty-hint {
  margin-left: 4px;
  color: rgba(188, 205, 228, 0.62);
  font-size: 12px;
}

.dialogue-instruction {
  flex: 1 1 0;
  min-height: 0;
  height: 100%;
}
</style>
