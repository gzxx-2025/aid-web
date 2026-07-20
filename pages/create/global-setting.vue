<template>
  <GlobalSettingPagePanel
    :title="titleDraft"
    :project-type="projectTypeDraft"
    :draft="draft"
    :project-type-locked="projectTypeLocked"
    @update:title="titleDraft = $event"
    @update:project-type="projectTypeDraft = $event"
    @update:field="updateField"
    @patch-style="patchStyle"
  />
</template>

<script setup lang="ts">
import GlobalSettingPagePanel from '~/components/steps/GlobalSettingPagePanel.vue'
import { useCreateFlowShell } from '~/composables/useCreateFlowShell'
import { routePathToCreationStep } from '~/utils/createFlowRoutes'
import { watch } from 'vue'

definePageMeta({ layout: 'create' })

const route = useRoute()
const {
  titleDraft,
  projectTypeDraft,
  draft,
  projectTypeLocked,
  syncFromStore,
  updateField,
  patchStyle
} = useCreateFlowShell().globalSetting

watch(
  () => route.path,
  (path) => {
    if (routePathToCreationStep(path) === 'global-setting') {
      syncFromStore()
    }
  },
  { immediate: true }
)
</script>
