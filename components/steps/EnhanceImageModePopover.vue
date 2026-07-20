<template>
  <div ref="rootRef" class="enhance-mode-popover-root">
    <div ref="triggerRef" class="enhance-mode-popover-trigger" @click.stop="toggle">
      <slot />
    </div>

    <Teleport to="body">
      <Transition name="enhance-mode-fade">
        <div
          v-if="open && readyToShowPanel"
          ref="panelRef"
          class="enhance-mode-panel"
          :class="{ 'is-open-down': !openUpward, 'is-open-up': openUpward }"
          :style="panelStyle"
          role="menu"
          aria-label="变清晰方式"
        >
          <button
            v-for="opt in visibleOptions"
            :key="opt.mode"
            type="button"
            class="enhance-mode-item"
            role="menuitem"
            @click.stop="pick(opt.mode)"
          >
            <div class="enhance-mode-thumb" :class="`enhance-mode-thumb--${opt.mode}`" aria-hidden="true">
              <span class="enhance-mode-thumb__half enhance-mode-thumb__half--before" />
              <span class="enhance-mode-thumb__divider" />
              <span class="enhance-mode-thumb__half enhance-mode-thumb__half--after" />
            </div>
            <div class="enhance-mode-body">
              <div class="enhance-mode-title-row">
                <span class="enhance-mode-title">{{ opt.title }}</span>
                <span class="enhance-mode-cost">
                  （消耗
                  <img :src="coinIcon" alt="" class="enhance-mode-coin" />
                  {{ opt.coins }}/张）
                </span>
              </div>
              <p class="enhance-mode-desc">{{ opt.desc }}</p>
            </div>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import coinIcon from '~/assets/img/home/starlightCoin.svg'
import type { EnhanceImageMode } from '~/types/enhanceImageMode'

const emit = defineEmits<{
  select: [payload: { mode: EnhanceImageMode; imageIndex: number }]
}>()

const props = withDefaults(
  defineProps<{
    /** 当前画布图片索引，随选项一并回传便于父级处理 */
    imageIndex: number
    /** 可选模式；默认展示全部，场景/角色/道具弹窗仅传 redraw_ultra */
    modes?: EnhanceImageMode[]
  }>(),
  {
    imageIndex: 0,
    modes: () => ['redraw_ultra', 'lossless_upscale']
  }
)

const ESTIMATED_PANEL_MIN = 200
const GAP = 8

const ALL_OPTIONS: Array<{
  mode: EnhanceImageMode
  title: string
  coins: number
  desc: string
}> = [
  {
    mode: 'redraw_ultra',
    title: '重绘超清',
    coins: 16,
    desc: 'AI 补充细节与纹理，生成4K大片质感'
  },
  {
    mode: 'lossless_upscale',
    title: '无损放大',
    coins: 2,
    desc: '忠于原图，放大至2倍尺寸，上限2K'
  }
]

const visibleOptions = computed(() => {
  const allowed = new Set(props.modes)
  return ALL_OPTIONS.filter((opt) => allowed.has(opt.mode))
})

const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const open = ref(false)
const openUpward = ref(false)
const readyToShowPanel = ref(false)
const panelFixedStyle = ref<Record<string, string>>({})

const panelStyle = computed(() => panelFixedStyle.value)

function updatePlacement() {
  if (!open.value || !triggerRef.value) return

  const rect = triggerRef.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom - GAP
  const spaceAbove = rect.top - GAP

  let upward = false
  if (spaceBelow >= ESTIMATED_PANEL_MIN) {
    upward = false
  } else if (spaceAbove >= ESTIMATED_PANEL_MIN) {
    upward = true
  } else {
    upward = spaceAbove > spaceBelow
  }

  openUpward.value = upward

  const minW = 320
  const widthPx = Math.min(Math.max(rect.width, minW), Math.min(420, window.innerWidth - 24))
  let leftPx = rect.left
  leftPx = Math.max(12, Math.min(leftPx, window.innerWidth - widthPx - 12))

  const z = '5500'

  if (!upward) {
    panelFixedStyle.value = {
      position: 'fixed',
      left: `${leftPx}px`,
      top: `${rect.bottom + GAP}px`,
      width: `${widthPx}px`,
      zIndex: z
    }
  } else {
    panelFixedStyle.value = {
      position: 'fixed',
      left: `${leftPx}px`,
      bottom: `${window.innerHeight - rect.top + GAP}px`,
      width: `${widthPx}px`,
      zIndex: z
    }
  }
}

function toggle() {
  open.value = !open.value
}

function pick(mode: EnhanceImageMode) {
  emit('select', { mode, imageIndex: props.imageIndex })
  open.value = false
}

function onViewportChange() {
  if (open.value) updatePlacement()
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
    if (!open.value || !root) return
    const target = e.target as Node | null
    if (!target) return
    if (root.contains(target) || (panel && panel.contains(target))) return
    open.value = false
  }
  document.addEventListener('mousedown', docMouseDownHandler, true)
}

watch(
  () => open.value,
  async (isOpen) => {
    if (isOpen) {
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

watch(
  () => props.imageIndex,
  () => {
    if (open.value) updatePlacement()
  }
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
.enhance-mode-popover-root {
  display: inline-flex;
  vertical-align: middle;
}

.enhance-mode-popover-trigger {
  display: inline-flex;
}

.enhance-mode-panel {
  padding: 10px;
  border-radius: 12px;
  background: rgba(19, 23, 34, 0.98);
  border: 1px solid rgba(74, 231, 253, 0.22);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
  box-sizing: border-box;
}

.enhance-mode-panel.is-open-down {
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
}

.enhance-mode-panel.is-open-up {
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
}

.enhance-mode-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 10px 10px;
  margin: 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: #e8ecf4;
  transition: background 0.15s ease;
}

.enhance-mode-item:hover {
  background: rgba(74, 231, 253, 0.08);
}

.enhance-mode-item + .enhance-mode-item {
  border-top: 1px solid rgba(120, 140, 170, 0.18);
  margin-top: 4px;
  padding-top: 14px;
}

.enhance-mode-thumb {
  position: relative;
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  background: #1a2233;
}

.enhance-mode-thumb__half {
  flex: 1;
  height: 100%;
}

.enhance-mode-thumb__half--before {
  filter: blur(1.2px) saturate(0.85);
  opacity: 0.72;
}

.enhance-mode-thumb__half--after {
  filter: contrast(1.08) saturate(1.05);
}

.enhance-mode-thumb--redraw_ultra .enhance-mode-thumb__half--before {
  background: linear-gradient(135deg, #4a3728 0%, #6b5344 100%);
}

.enhance-mode-thumb--redraw_ultra .enhance-mode-thumb__half--after {
  background: linear-gradient(135deg, #c27850 0%, #e8c9a8 100%);
}

.enhance-mode-thumb--lossless_upscale .enhance-mode-thumb__half--before {
  background: linear-gradient(135deg, #3d2f55 0%, #524070 100%);
}

.enhance-mode-thumb--lossless_upscale .enhance-mode-thumb__half--after {
  background: linear-gradient(135deg, #7c5cbf 0%, #a8e890 45%, #6fd4c4 100%);
}

.enhance-mode-thumb__divider {
  position: absolute;
  left: 50%;
  top: 4px;
  bottom: 4px;
  width: 2px;
  margin-left: -1px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 1px;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.35);
}

.enhance-mode-body {
  flex: 1;
  min-width: 0;
}

.enhance-mode-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
}

.enhance-mode-title {
  color: #f1f5ff;
}

.enhance-mode-cost {
  font-size: 12px;
  font-weight: 500;
  color: #a8b4c8;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.enhance-mode-coin {
  width: 14px;
  height: 14px;
  vertical-align: middle;
  display: inline-block;
}

.enhance-mode-desc {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: #8e97a5;
}

.enhance-mode-fade-enter-active,
.enhance-mode-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.enhance-mode-fade-enter-from,
.enhance-mode-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.enhance-mode-panel.is-open-up.enhance-mode-fade-enter-from,
.enhance-mode-panel.is-open-up.enhance-mode-fade-leave-to {
  transform: translateY(-4px);
}
</style>
