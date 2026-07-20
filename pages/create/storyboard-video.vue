<template>
  <StoryboardVideo
    v-model="storyboardVideoPanelsModel"
    description="将分镜脚本转换为动态视频，预览视觉效果"
    :storyboard-script-panels="storyboardScriptPanelsForVideo"
    @go-step="shell.goToStep"
    @jump-to-storyboard-script="shell.jumpToStoryboardScriptFromVideo"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import StoryboardVideo from '~/components/steps/StoryboardVideo.vue'
import type { StoryboardPanel, StoryboardVideoPanel } from '~/types'
import { useCreationStore } from '~/stores/creation'
import { useCreateFlowShell } from '~/composables/useCreateFlowShell'

definePageMeta({ layout: 'create' })

const creationStore = useCreationStore()
const shell = useCreateFlowShell()

const storyboardVideoPanelsModel = computed({
  get: (): StoryboardVideoPanel[] => creationStore.formData.storyboardVideo.panels,
  set: (v: StoryboardVideoPanel[]) => {
    creationStore.formData.storyboardVideo.panels = v
  }
})

const storyboardScriptPanelsForVideo = computed((): Array<{ id: string; title: string; [key: string]: unknown }> =>
  (creationStore.formData.storyboardScript.panels as StoryboardPanel[]).map(p => ({
    id: p.id,
    title: p.title,
    ...p
  }))
)

</script>
