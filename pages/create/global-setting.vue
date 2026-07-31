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
import { useGlobalSettingProjectHydrate } from '~/composables/useGlobalSettingProjectHydrate'
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

const { hydrateFromProjectApi } = useGlobalSettingProjectHydrate()

async function syncGlobalSettingPageFromServer() {
  if (routePathToCreationStep(route.path) !== 'global-setting') return
  const hydrated = await hydrateFromProjectApi(route)
  if (hydrated) {
    syncFromStore()
  }
}

watch(
  () => [route.path, route.query.projectId, route.query.id, route.query.workId] as const,
  () => {
    void syncGlobalSettingPageFromServer()
  },
  { immediate: true }
)
</script>
