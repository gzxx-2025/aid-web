<template>
  <span class="app-confirm-icon" :class="`app-confirm-icon--${variant}`" aria-hidden="true">
    <img class="app-confirm-icon__img" :src="iconSrc" alt="" />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import informationIcon from '~/assets/img/icon/information.svg'
import deleteIcon from '~/assets/img/icon/Delelte.svg'

export type AppConfirmIconVariant = 'info' | 'warning' | 'danger'

const props = withDefaults(
  defineProps<{
    variant?: AppConfirmIconVariant
  }>(),
  { variant: 'info' }
)

const iconSrc = computed(() =>
  props.variant === 'danger' ? deleteIcon : informationIcon
)
</script>

<style scoped>
.app-confirm-icon {
  flex: none;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  line-height: 1;
}

.app-confirm-icon__img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  display: block;
}

.app-confirm-icon--danger .app-confirm-icon__img {
  width: 20px;
  height: 20px;
}
</style>
