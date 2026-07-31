<template>
  <div class="dialogue-draw-panel create-modal-tab-panel" :data-source-type="sourceType">
    <div class="create-modal-tab-chrome dialogue-draw-panel__chrome">
      <GenerateSourceImagesStrip
        :images="sourceImages"
        :show-adder="sourceImages.length < maxSourceCount"
        :show-adder-text="!sourceImages.length"
        adder-text="导入参考图"
        :empty-hint="maxSourceCount === 1 && !sourceImages.length ? '仅支持 1 张参考图' : ''"
        @remove="$emit('remove-source-image', $event)"
        @open-adder="$emit('open-source-picker')"
      />
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
import RichTextEditor from '~/components/common/RichTextEditor.vue'
import GenerateModelConfigBlock from './GenerateModelConfigBlock.vue'
import GenerateSourceImagesStrip from './GenerateSourceImagesStrip.vue'
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
  maxSourceCount: 4
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

.dialogue-instruction {
  flex: 1 1 0;
  min-height: 0;
  height: 100%;
}
</style>
