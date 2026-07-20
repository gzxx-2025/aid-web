<template>
  <WorksLibraryPanel @open-create="onOpenCreate" />
</template>

<script setup lang="ts">
import WorksLibraryPanel from '~/components/home/WorksLibraryPanel.vue'

definePageMeta({
  layout: 'home'
})

const router = useRouter()
const userStore = useUserStore()

const isLoggedIn = computed(() => !!userStore.token)
const homeCreateModal = useHomeShellCreateModal()

function goLogin() {
  router.push('/login')
}

function onOpenCreate(tab: 'film' | 'series') {
  if (!isLoggedIn.value) {
    goLogin()
    return
  }
  homeCreateModal.openCreateModal({ worksTab: tab })
}
</script>
