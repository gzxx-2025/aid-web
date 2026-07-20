<template>
  <Dubbing
    v-model="dubbingPanelsModel"
    description="为视频添加配音，系统将自动匹配口型"
    :storyboard-video-panels="formData.storyboardVideo.panels"
    :storyboard-script-panels="formData.storyboardScript.panels as StoryboardPanel[]"
    :scene-characters="formData.sceneCharacter.characters"
    @update:storyboard-video-panels="onUpdateStoryboardVideo"
    @go-step="shell.goToStep"
    @generating="shell.setDubbingGenerating"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import Dubbing from '~/components/steps/Dubbing.vue'
import type { DubbingPanel, StoryboardPanel, StoryboardVideoPanel } from '~/types'
import { useCreationStore } from '~/stores/creation'
import { useCreateFlowShell } from '~/composables/useCreateFlowShell'

definePageMeta({ layout: 'create' })

const creationStore = useCreationStore()
const { formData } = storeToRefs(creationStore)
const shell = useCreateFlowShell()

const dubbingPanelsModel = computed({
  get: (): DubbingPanel[] => creationStore.formData.dubbing.panels,
  set: (v: DubbingPanel[]) => {
    creationStore.formData.dubbing.panels = v
  }
})

function onUpdateStoryboardVideo(v: StoryboardVideoPanel[]) {
  creationStore.formData.storyboardVideo.panels = v
}
</script>
