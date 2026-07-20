<template>
  <div ref="rootRef" class="setting-select-field">
    <button
      ref="triggerRef"
      type="button"
      :disabled="!options.length"
      :class="['setting-select', { active: open, 'is-empty': !options.length }]"
      @click.stop="onTriggerClick"
    >
      <span>{{ triggerLabel }}</span>
      <RightOutlined />
    </button>

    <Teleport to="body">
      <Transition name="setting-select-fade">
        <div
          v-if="open && options.length && readyToShowPanel"
          ref="panelRef"
          class="setting-select-panel-fixed"
          :style="panelStyle"
          role="dialog"
          :aria-label="panelTitle"
        >
          <div class="setting-select-panel">
            <div class="setting-select-panel-title">{{ panelTitle }}</div>
            <div class="setting-select-grid">
              <div
                v-for="opt in options"
                :key="opt.key"
                :class="['setting-select-option', { 'is-selected': modelValue?.key === opt.key }]"
                @click="onSelect(opt)"
              >
                <div class="setting-select-option-thumb">
                  <img v-if="opt.image" :src="opt.image" :alt="opt.value" class="option-thumb-img" />
                  <span v-else-if="opt.key === 'none'" class="option-icon-none">／</span>
                  <span v-else class="option-icon-placeholder">{{
                    (opt.value || '').charAt(0)
                  }}</span>
                </div>
                <span class="setting-select-option-label">{{ opt.value }}</span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RightOutlined } from '@ant-design/icons-vue'
import { toLayoutPx } from '~/utils/viewportZoom'

export interface SettingSelectOption {
  key: string
  value: string
  image?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: { key: string; value: string } | null
    options: SettingSelectOption[]
    placeholder?: string
    panelTitle: string
    open: boolean
  }>(),
  {
    placeholder: '请选择'
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: { key: string; value: string }]
  'update:open': [value: boolean]
}>()

const PANEL_WIDTH = 520
const PANEL_HEIGHT = 460
const GAP = 8
const PANEL_Z_INDEX = '1060'

const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const readyToShowPanel = ref(false)
const panelFixedStyle = ref<Record<string, string>>({})

const panelStyle = computed(() => panelFixedStyle.value)

const triggerLabel = computed(() => {
  if (!props.options.length) return '暂无数据'
  return props.modelValue ? props.modelValue.value : props.placeholder
})

function updatePlacement() {
  if (!props.open || !triggerRef.value) return

  const rect = triggerRef.value.getBoundingClientRect()
  const panelW = Math.min(PANEL_WIDTH, window.innerWidth - 24)
  const panelH = Math.min(PANEL_HEIGHT, window.innerHeight * 0.85)

  let leftPx = rect.right + GAP
  if (leftPx + panelW > window.innerWidth - 12) {
    leftPx = rect.left - panelW - GAP
  }
  leftPx = Math.max(12, Math.min(leftPx, window.innerWidth - panelW - 12))

  let topPx = rect.top
  topPx = Math.max(12, Math.min(topPx, window.innerHeight - panelH - 12))

  panelFixedStyle.value = {
    position: 'fixed',
    left: `${toLayoutPx(leftPx)}px`,
    top: `${toLayoutPx(topPx)}px`,
    width: `${toLayoutPx(panelW)}px`,
    height: `${toLayoutPx(panelH)}px`,
    zIndex: PANEL_Z_INDEX
  }
}

function onTriggerClick() {
  if (!props.options.length) return
  emit('update:open', !props.open)
}

const onSelect = (opt: { key: string; value: string }) => {
  emit('update:modelValue', { key: opt.key, value: opt.value })
  emit('update:open', false)
}

function onViewportChange() {
  if (props.open) updatePlacement()
}

let docMouseDownHandler: ((e: MouseEvent) => void) | null = null

function unbindClickOutside() {
  if (docMouseDownHandler) {
    document.removeEventListener('mousedown', docMouseDownHandler, true)
    docMouseDownHandler = null
  }
}

function bindClickOutside() {
  unbindClickOutside()
  docMouseDownHandler = (e: MouseEvent) => {
    const root = rootRef.value
    const panel = panelRef.value
    if (!props.open || !root) return
    const target = e.target as Node | null
    if (!target) return
    if (root.contains(target) || (panel && panel.contains(target))) return
    emit('update:open', false)
  }
  document.addEventListener('mousedown', docMouseDownHandler, true)
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen && props.options.length) {
      readyToShowPanel.value = false
      unbindClickOutside()
      await nextTick()
      updatePlacement()
      readyToShowPanel.value = true
      await nextTick()
      bindClickOutside()
    } else {
      readyToShowPanel.value = false
      panelFixedStyle.value = {}
      unbindClickOutside()
    }
  },
  { flush: 'post' }
)

onMounted(() => {
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})

onUnmounted(() => {
  unbindClickOutside()
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})
</script>

<style scoped>
.setting-select {
  width: 100%;
  height: 36px;
  border-radius: 8px;
  border: none;
  background: #121212;
  color: var(--gray-700);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.75rem;
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.setting-select :deep(svg),
.setting-select :deep(.anticon) {
  flex-shrink: 0;
}

.setting-select:hover {
  border-color: var(--accent-500);
}

.setting-select:disabled,
.setting-select.is-empty {
  cursor: not-allowed;
  opacity: 0.65;
}

.setting-select.active {
  border-color: var(--accent-500);
  box-shadow: 0 0 0 2px var(--accent-100);
}

.setting-select-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: rgba(6, 10, 18, 0.55);
  padding: 0.75rem 1rem;
  box-sizing: border-box;
}

.setting-select-panel-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--gray-50);
  margin-bottom: 0.75rem;
  flex-shrink: 0;
}

.setting-select-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  align-content: start;
  grid-auto-rows: max-content;
}

.setting-select-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.5rem;
  align-self: start;
  width: 100%;
  box-sizing: border-box;
  background: rgba(12, 16, 24, 0.85);
  border-radius: var(--radius-md);
  border: 1px solid var(--gray-200);
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.setting-select-option:hover {
  border-color: var(--accent-400);
}

.setting-select-option.is-selected {
  border-color: rgba(74, 231, 253, 0.55);
  box-shadow: 0 0 0 1px rgba(74, 231, 253, 0.25);
}

.setting-select-option-thumb {
  width: 100%;
  height: 92px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: rgba(6, 10, 18, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gray-500);
  font-size: 1rem;
  overflow: hidden;
}

.option-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.option-icon-none {
  font-size: 1.25rem;
  color: var(--gray-400);
}

.option-icon-placeholder {
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-400);
}

.setting-select-option-label {
  font-size: 0.75rem;
  color: var(--gray-50);
  text-align: center;
  line-height: 1.2;
}
</style>

<!-- 弹层 Teleport 到 body，低分辨率 zoom 补偿见 viewport-compact-scale-overrides.css -->
<style>
.setting-select-panel-fixed {
  box-sizing: border-box;
  border-radius: var(--radius-md, 8px);
  background: rgba(19, 23, 34, 0.98);
  border: 1px solid rgba(74, 231, 253, 0.22);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.setting-select-fade-enter-active,
.setting-select-fade-leave-active {
  transition: opacity 0.15s ease;
}

.setting-select-fade-enter-from,
.setting-select-fade-leave-to {
  opacity: 0;
}
</style>
