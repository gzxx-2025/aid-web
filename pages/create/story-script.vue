<template>
  <StoryScript
    :model-value="formData.storyScript.content"
    @update:model-value="onUpdate"
  />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import StoryScript from '~/components/steps/StoryScript.vue'
import { useCreationStore } from '~/stores/creation'

definePageMeta({ layout: 'create' })

const creationStore = useCreationStore()
const { formData } = storeToRefs(creationStore)

function onUpdate(v: string) {
  creationStore.updateFormData({ storyScript: { content: v } })
}
</script>
