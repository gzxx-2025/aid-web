<template>
  <StoryboardScript
    v-model="storyboardScriptPanelsModel"
    :edit-script-tooltip-target-index="editScriptTooltipTargetIndex"
    :edit-script-tooltip-key="editScriptTooltipKey"
    @go-step="shell.goToStep"
    @generation-complete="shell.syncVideoAndDubbingFromScriptPanels"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import StoryboardScript from '~/components/steps/StoryboardScript.vue'
import type { StoryboardPanel } from '~/types'
import { useCreationStore } from '~/stores/creation'
import { useCreateFlowShell } from '~/composables/useCreateFlowShell'

definePageMeta({ layout: 'create' })

const creationStore = useCreationStore()
const shell = useCreateFlowShell()

const editScriptTooltipTargetIndex = computed(() => shell.storyboardScriptTooltipTargetIndex.value)
const editScriptTooltipKey = computed(() => shell.storyboardScriptTooltipKey.value)

const storyboardScriptPanelsModel = computed({
  get: (): StoryboardPanel[] => creationStore.formData.storyboardScript.panels as StoryboardPanel[],
  set: (v: StoryboardPanel[]) => {
    creationStore.formData.storyboardScript.panels = v
  }
})
</script>
