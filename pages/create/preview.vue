<template>
  <VideoPreview
    :key="previewScopeKey"
    :storyboard-video-panels="formData.storyboardVideo.panels"
    :dubbing-panels="formData.dubbing.panels"
    :bgm="formData.dubbing.bgm"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import VideoPreview from '~/components/steps/VideoPreview.vue'
import { useCreationStore } from '~/stores/creation'

definePageMeta({ layout: 'create' })

const creationStore = useCreationStore()
const { formData } = storeToRefs(creationStore)

const previewScopeKey = computed(
  () => `${creationStore.currentProjectId ?? 'na'}:${creationStore.currentEpisodeId ?? 'na'}`
)
</script>
