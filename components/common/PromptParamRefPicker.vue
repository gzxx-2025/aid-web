<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="prompt-param-ref-picker-mask"
      @click="$emit('close')"
    />
    <div
      v-if="open"
      class="prompt-param-ref-picker"
      :style="panelStyle"
      role="listbox"
      @click.stop
    >
      <button
        v-for="opt in options"
        :key="opt.key"
        type="button"
        class="prompt-param-ref-picker__item"
        :class="{ 'is-selected': opt.key === selectedKey }"
        @click="$emit('select', opt)"
      >
        <span class="prompt-param-ref-picker__name">{{ opt.value }}</span>
        <CheckCircleFilled
          v-if="opt.key === selectedKey"
          class="prompt-param-ref-picker__check"
        />
      </button>
      <div v-if="!options.length" class="prompt-param-ref-picker__empty">暂无可选项</div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircleFilled } from '@ant-design/icons-vue'
import type { PromptParamOption } from '~/utils/storyboardPromptParamRef'

const props = defineProps<{
  open: boolean
  options: PromptParamOption[]
  selectedKey?: string
  anchorRect?: DOMRect | null
}>()

defineEmits<{
  close: []
  select: [option: PromptParamOption]
}>()

const panelStyle = computed(() => {
  const r = props.anchorRect
  if (!r) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  const top = Math.min(r.bottom + 6, window.innerHeight - 280)
  const left = Math.min(Math.max(8, r.left), window.innerWidth - 220)
  return { top: `${top}px`, left: `${left}px` }
})
</script>

<style scoped lang="scss">
.prompt-param-ref-picker-mask {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: transparent;
}

.prompt-param-ref-picker {
  position: fixed;
  z-index: 1101;
  min-width: 160px;
  max-width: 240px;
  max-height: 260px;
  overflow-y: auto;
  padding: 6px;
  border-radius: 10px;
  background: rgba(28, 32, 40, 0.98);
  border: 1px solid rgba(128, 154, 188, 0.35);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}

.prompt-param-ref-picker__item {
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

  &:last-child {
    margin-bottom: 0;
  }

  &:hover {
    background: rgba(74, 231, 253, 0.1);
  }

  &.is-selected {
    background: rgba(74, 231, 253, 0.14);
  }
}

.prompt-param-ref-picker__name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prompt-param-ref-picker__check {
  flex-shrink: 0;
  font-size: 16px;
  color: #52c41a;
}

.prompt-param-ref-picker__empty {
  padding: 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  text-align: center;
}
</style>
