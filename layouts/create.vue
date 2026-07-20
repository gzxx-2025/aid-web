<template>
  <CreateFlowShell>
    <slot />
  </CreateFlowShell>
</template>

<script setup lang="ts">
import CreateFlowShell from '~/components/create/CreateFlowShell.vue'

useHead({
  htmlAttrs: {
    class: 'app-shell-create layout-create-flow'
  }
})
</script>

<style>
/* 创作流程：锁定视口高度，滚动发生在 preview-content / 步骤内部 */
html.layout-create-flow,
html.layout-create-flow body,
html.layout-create-flow #__nuxt,
html.layout-create-flow #__nuxt > div {
  height: 100%;
  overflow: hidden;
}
</style>
