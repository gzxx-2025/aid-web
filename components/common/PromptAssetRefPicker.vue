<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="prompt-asset-ref-picker-mask"
      @click="$emit('close')"
    />
    <div
      v-if="open"
      class="prompt-asset-ref-picker"
      :style="panelStyle"
      role="listbox"
      @click.stop
    >
      <button
        v-for="item in assets"
        :key="item.assetId"
        type="button"
        class="prompt-asset-ref-picker__item"
        :class="{ 'is-selected': item.assetId === selectedAssetId }"
        @click="$emit('select', item)"
      >
        <img
          v-if="item.url"
          class="prompt-asset-ref-picker__thumb"
          :src="item.url"
          :alt="item.name"
        />
        <span v-else class="prompt-asset-ref-picker__thumb prompt-asset-ref-picker__thumb--empty" />
        <span class="prompt-asset-ref-picker__name">{{ item.label }}</span>
        <CheckCircleFilled
          v-if="item.assetId === selectedAssetId"
          class="prompt-asset-ref-picker__check"
        />
      </button>
      <div v-if="!assets.length" class="prompt-asset-ref-picker__empty">暂无已导入图片</div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircleFilled } from '@ant-design/icons-vue'
import type { PromptAssetItem } from '~/utils/storyboardPromptAssetRef'

const props = defineProps<{
  open: boolean
  assets: PromptAssetItem[]
  selectedAssetId?: string
  anchorRect?: DOMRect | null
}>()

defineEmits<{
  close: []
  select: [item: PromptAssetItem]
}>()

const panelStyle = computed(() => {
  const r = props.anchorRect
  if (!r) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  const top = Math.min(r.bottom + 6, window.innerHeight - 280)
  const left = Math.min(Math.max(8, r.left), window.innerWidth - 280)
  return { top: `${top}px`, left: `${left}px` }
})
</script>

<style scoped lang="scss">
.prompt-asset-ref-picker-mask {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: transparent;
}

.prompt-asset-ref-picker {
  position: fixed;
  z-index: 1101;
  min-width: 220px;
  max-width: 280px;
  max-height: 260px;
  overflow-y: auto;
  padding: 6px;
  border-radius: 10px;
  background: rgba(28, 32, 40, 0.98);
  border: 1px solid rgba(128, 154, 188, 0.35);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}

.prompt-asset-ref-picker__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: rgba(225, 239, 255, 0.92);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
  margin-bottom: 4px;
  &:last-child{
    margin-bottom: 0;
  }
  &:hover {
    background: rgba(74, 231, 253, 0.1);
  }

  &.is-selected {
    background: rgba(74, 231, 253, 0.14);
  }
}

.prompt-asset-ref-picker__thumb {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid rgba(128, 154, 188, 0.25);
}

.prompt-asset-ref-picker__thumb--empty {
  display: inline-block;
  background: rgba(8, 12, 20, 0.9);
}

.prompt-asset-ref-picker__name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prompt-asset-ref-picker__check {
  flex-shrink: 0;
  font-size: 16px;
  color: #52c41a;
}

.prompt-asset-ref-picker__empty {
  padding: 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  text-align: center;
}
</style>
