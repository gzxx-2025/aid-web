<template>
  <div ref="rootRef" class="upscale-model-popover-root">
    <div
      ref="triggerRef"
      class="upscale-model-popover-trigger"
      :class="{ 'is-disabled': disabled }"
      @click.stop="toggle"
    >
      <slot />
    </div>

    <Teleport to="body">
      <Transition name="upscale-model-fade">
        <div
          v-if="open && readyToShowPanel"
          ref="panelRef"
          class="upscale-model-panel"
          :class="{ 'is-open-down': !openUpward, 'is-open-up': openUpward }"
          :style="panelStyle"
          role="menu"
          aria-label="变清晰模型"
        >
          <div v-if="loading" class="upscale-model-empty">加载中…</div>
          <template v-else-if="modelOptions.length">
            <p class="upscale-model-section-label">图片高清模型</p>
            <div class="upscale-model-list">
              <button
                v-for="opt in modelOptions"
                :key="`upscale-${opt.id}`"
                type="button"
                class="upscale-model-item"
                role="menuitem"
                :disabled="generating"
                @click.stop="pick(opt)"
              >
                <div
                  class="upscale-model-thumb"
                  :style="{ background: opt.iconBg || '#60A5FA' }"
                  aria-hidden="true"
                >
                  <img v-if="opt.icon" :src="opt.icon" :alt="opt.name" class="upscale-model-thumb__img" />
                  <span v-else class="upscale-model-thumb__letter">{{ (opt.name || '?').slice(0, 1) }}</span>
                </div>
                <div class="upscale-model-body">
                  <div class="upscale-model-title-row">
                    <span class="upscale-model-title">{{ opt.name }}</span>
                    <span v-if="opt.resolutionLabel" class="upscale-model-tag">{{ opt.resolutionLabel }}</span>
                  </div>
                  <p v-if="opt.desc" class="upscale-model-desc">{{ opt.desc }}</p>
                </div>
              </button>
            </div>
          </template>
          <div v-else class="upscale-model-empty">暂无可用高清模型</div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { userModelListByFunc } from '~/utils/businessApi'
import { AI_MODEL_FUNC_CODE } from '~/utils/aiModelFuncCodes'
import type { UserModelListItem } from '~/types/business-api'

export interface UpscaleModelOption {
  id: string
  name: string
  icon?: string
  iconBg?: string
  desc?: string
  resolution: string
  resolutionLabel?: string
}

const emit = defineEmits<{
  select: [payload: { modelCode: string; resolution: string; imageIndex: number }]
}>()

const props = withDefaults(
  defineProps<{
    imageIndex: number
    disabled?: boolean
    generating?: boolean
    /** form-image 用小写 2k；分镜图高清用大写 2K */
    resolutionFormat?: 'lower' | 'upper'
  }>(),
  {
    imageIndex: 0,
    disabled: false,
    generating: false,
    resolutionFormat: 'lower'
  }
)

const ESTIMATED_PANEL_MIN = 200
const GAP = 8

const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const open = ref(false)
const openUpward = ref(false)
const readyToShowPanel = ref(false)
const panelFixedStyle = ref<Record<string, string>>({})
const loading = ref(false)
const modelOptions = ref<UpscaleModelOption[]>([])

const panelStyle = computed(() => panelFixedStyle.value)

function normalizeSizeCode(raw: string): string {
  const t = String(raw || '').trim()
  if (!t) return ''
  if (/^\d+k$/i.test(t)) return t.toLowerCase()
  return t.toLowerCase()
}

function formatResolution(raw: string): string {
  const normalized = normalizeSizeCode(raw) || '2k'
  if (props.resolutionFormat === 'upper') {
    return /^\d+k$/.test(normalized) ? normalized.toUpperCase() : raw || '2K'
  }
  return normalized
}

function formatResolutionLabel(raw: string): string {
  const formatted = formatResolution(raw)
  return /^\d+k$/i.test(formatted) ? formatted.toUpperCase() : formatted
}

function mapModelRow(item: UserModelListItem): UpscaleModelOption | null {
  const code = String(item.modelCode || '').trim()
  if (!code) return null
  const rawSize = String(item.defaultSizeCode || '2k').trim()
  const resolution = formatResolution(rawSize)
  return {
    id: code,
    name: item.modelName || code,
    iconBg: '#60A5FA',
    desc: item.providerName ? `服务商：${item.providerName}` : '',
    resolution,
    resolutionLabel: formatResolutionLabel(rawSize)
  }
}

async function loadOptions() {
  loading.value = true
  try {
    const models = await userModelListByFunc(AI_MODEL_FUNC_CODE.IMAGE_UPSCALE)
    modelOptions.value = (Array.isArray(models) ? models : [])
      .map(mapModelRow)
      .filter((m): m is UpscaleModelOption => Boolean(m))
  } catch {
    modelOptions.value = []
  } finally {
    loading.value = false
  }
}

function pick(opt: UpscaleModelOption) {
  if (props.generating) return
  const modelCode = String(opt.id || '').trim()
  if (!modelCode) return
  emit('select', {
    modelCode,
    resolution: opt.resolution,
    imageIndex: props.imageIndex
  })
  open.value = false
}

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
  if (props.disabled) return
  open.value = !open.value
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
      void loadOptions()
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
.upscale-model-popover-root {
  display: inline-flex;
  vertical-align: middle;
}

.upscale-model-popover-trigger {
  display: inline-flex;
}

.upscale-model-popover-trigger.is-disabled {
  cursor: not-allowed;
}

.upscale-model-panel {
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(19, 23, 34, 0.98);
  border: 1px solid rgba(74, 231, 253, 0.22);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
  box-sizing: border-box;
  max-height: min(420px, 62vh);
  overflow: hidden;
}

.upscale-model-panel.is-open-down {
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
}

.upscale-model-panel.is-open-up {
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
}

.upscale-model-section-label {
  flex-shrink: 0;
  margin: 0 0 4px;
  padding: 0 2px;
  font-size: 12px;
  font-weight: 600;
  color: #8e97a5;
}

.upscale-model-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  margin: 0 -2px;
  padding: 0 2px 2px;
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 140, 170, 0.4) transparent;
}

.upscale-model-list::-webkit-scrollbar {
  width: 4px;
}

.upscale-model-list::-webkit-scrollbar-thumb {
  background: rgba(120, 140, 170, 0.35);
  border-radius: 4px;
}

.upscale-model-empty {
  padding: 12px 8px;
  font-size: 13px;
  color: #8e97a5;
  text-align: center;
}

.upscale-model-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 8px;
  margin: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: #e8ecf4;
  transition: background 0.15s ease;
  box-sizing: border-box;
}

.upscale-model-item:hover:not(:disabled) {
  background: rgba(74, 231, 253, 0.08);
}

.upscale-model-item:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.upscale-model-thumb {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.upscale-model-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upscale-model-thumb__letter {
  line-height: 1;
}

.upscale-model-body {
  flex: 1;
  min-width: 0;
}

.upscale-model-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
}

.upscale-model-title {
  color: #f1f5ff;
}

.upscale-model-tag {
  font-size: 12px;
  font-weight: 500;
  color: #4ae7fd;
}

.upscale-model-desc {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: #8e97a5;
}

.upscale-model-fade-enter-active,
.upscale-model-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.upscale-model-fade-enter-from,
.upscale-model-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.upscale-model-panel.is-open-up.upscale-model-fade-enter-from,
.upscale-model-panel.is-open-up.upscale-model-fade-leave-to {
  transform: translateY(-4px);
}
</style>
