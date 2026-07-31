<template>
  <SceneCharacterProp
    :model-value="formData.sceneCharacter"
    :story-script-content="formData.storyScript.content"
    :is-extracting="creationStore.isExtractingAssets"
    :extracting-stage="extractingStage"
    :extracting-stages="extractingStages"
    @update:model-value="creationStore.updateSceneCharacterData"
    @stop-extract="shell.stopExtractAssets"
    @open-extract-modal="shell.openExtractModalFromScp"
  />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import SceneCharacterProp from '~/components/steps/SceneCharacterProp.vue'
import { useCreationStore } from '~/stores/creation'
import { useCreateFlowShell } from '~/composables/useCreateFlowShell'

definePageMeta({ layout: 'create' })

const creationStore = useCreationStore()
const { formData, extractingStage, extractingStages } = storeToRefs(creationStore)
const shell = useCreateFlowShell()
</script>
