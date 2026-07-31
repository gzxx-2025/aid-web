<template>
  <InvitePanel />
</template>

<script setup lang="ts">
import InvitePanel from '~/components/home/InvitePanel.vue'

definePageMeta({
  layout: 'home',
  middleware: 'auth'
})
</script>
