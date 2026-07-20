<template>
  <div class="global-setting-page-panel">
    <CreateFirstStepFormBody
      page-layout
      :open="true"
      flow-edit-mode
      :project-type-locked="projectTypeLocked"
      :title="title"
      :project-type="projectType"
      :aspect-ratio="draft.aspectRatio"
      :script-type="draft.scriptType"
      :model-strategy="draft.modelStrategy"
      :creation-mode="draft.creationMode"
      :model-value="draft"
      @update:title="emit('update:title', $event)"
      @update:project-type="emit('update:projectType', $event)"
      @update:aspect-ratio="emit('update:field', 'aspectRatio', $event)"
      @update:script-type="emit('update:field', 'scriptType', $event)"
      @update:model-strategy="emit('update:field', 'modelStrategy', $event)"
      @update:creation-mode="emit('update:field', 'creationMode', $event)"
      @update:model-value="emit('patchStyle', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import CreateFirstStepFormBody from '~/components/steps/CreateFirstStepFormBody.vue'
import type { GlobalSettingData } from '~/types'

type ProjectTypeValue = 'movie' | 'series'

defineProps<{
  title: string
  projectType: ProjectTypeValue
  draft: GlobalSettingData
  projectTypeLocked: boolean
}>()

const emit = defineEmits<{
  'update:title': [value: string]
  'update:projectType': [value: ProjectTypeValue]
  'update:field': [key: keyof GlobalSettingData, value: GlobalSettingData[keyof GlobalSettingData]]
  patchStyle: [patch: Pick<GlobalSettingData, 'selectedStyle' | 'myStyles' | 'style'>]
}>()
</script>

<style scoped lang="scss">
.global-setting-page-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  flex: 1;
  padding: 0 14px 14px;
  box-sizing: border-box;
}

.gsp-header {
  flex-shrink: 0;
  padding: 4px 0 12px;
}

.gsp-title {
  margin: 0 0 6px;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--home-text, #e6edf3);
  letter-spacing: 0.04em;
}

.gsp-desc {
  margin: 0;
  font-size: 0.875rem;
  color: var(--home-muted, #8e97a5);
  line-height: 1.5;
}

.global-setting-page-panel :deep(.create-first-step-form--page) {
  flex: 1;
  min-height: 0;
}
</style>
