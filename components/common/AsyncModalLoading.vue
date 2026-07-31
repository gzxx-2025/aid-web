<template>
  <div class="async-modal-loading" role="dialog" aria-modal="true" aria-label="正在打开编辑器">
    <div class="async-modal-loading__backdrop" />
    <div class="async-modal-loading__panel" aria-live="polite" aria-busy="true">
      <LoadingOutlined spin class="async-modal-loading__icon" />
      <span>正在打开编辑器...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LoadingOutlined } from '@ant-design/icons-vue'
</script>

<style scoped>
.async-modal-loading {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: grid;
  place-items: center;
}

.async-modal-loading__backdrop {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 45%);
}

.async-modal-loading__panel {
  position: relative;
  display: flex;
  min-width: 184px;
  min-height: 88px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px 24px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 12px 36px rgb(0 0 0 / 18%);
  color: #262626;
  font-size: 14px;
}

.async-modal-loading__icon {
  color: #1677ff;
  font-size: 20px;
}
</style>
