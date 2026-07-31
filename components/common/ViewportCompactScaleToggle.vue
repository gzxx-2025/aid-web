<template>
  <div
    v-if="canToggle"
    class="viewport-compact-scale-toggle"
    role="group"
    aria-label="低分辨率界面缩放"
  >
    <span class="viewport-compact-scale-toggle__label">界面缩放</span>
    <a-switch
      :checked="userEnabled"
      size="small"
      aria-label="低分辨率界面缩放"
      @change="setEnabled"
    />
  </div>
</template>

<script setup lang="ts">
const { userEnabled, canToggle, setEnabled } = useViewportCompactScale()
</script>

<style scoped>
.viewport-compact-scale-toggle {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 900;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(74, 231, 253, 0.22);
  background: rgba(12, 16, 24, 0.88);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.viewport-compact-scale-toggle__label {
  font-size: 12px;
  color: rgba(230, 237, 243, 0.88);
  white-space: nowrap;
  user-select: none;
}
</style>
