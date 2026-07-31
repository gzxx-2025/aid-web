<template>
  <StoryboardVideo
    v-model="storyboardVideoPanelsModel"
    description="将分镜转为动态视频，批量提交出片任务"
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

/** 直接透传 store 引用，避免每次 render 都 map 出新数组触发子组件 watcher */
const storyboardScriptPanelsForVideo = computed(
  () => creationStore.formData.storyboardScript.panels as StoryboardPanel[]
)

</script>
