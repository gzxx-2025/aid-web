<template>
  <div ref="rootRef" class="setting-card-popover-root">
    <div
      ref="triggerRef"
      class="setting-card-popover-trigger"
      :class="{ 'is-disabled': disabled }"
      @click.stop="toggle"
    >
      <slot />
    </div>

    <Teleport to="body">
      <Transition name="setting-card-fade">
        <div
          v-if="open && readyToShowPanel"
          ref="panelRef"
          class="setting-card-panel"
          :class="{ 'is-open-down': !openUpward, 'is-open-up': openUpward }"
          :style="panelStyle"
          role="menu"
          aria-label="生成角色设定卡"
        >
          <a-alert
            v-if="!isSupported"
            type="info"
            show-icon
            message="仅支持角色形态"
            class="setting-card-alert"
          />
          <a-alert
            v-else-if="!isWhiteBaseReady"
            type="warning"
            show-icon
            message="请先在列表中点击自动生成按钮生成图片以后再进行操作"
            class="setting-card-alert"
          />
          <div v-else-if="loading" class="setting-card-empty">加载中…</div>
          <div v-else class="setting-card-scroll">
            <template v-if="agentOptions.length">
              <p class="setting-card-section-label">智能体</p>
              <div class="setting-card-list">
                <button
                  v-for="opt in agentOptions"
                  :key="`agent-${opt.id}`"
                  type="button"
                  class="setting-card-item"
                  role="menuitem"
                  :disabled="generating"
                  @click.stop="pickAgent(opt)"
                >
                  <div class="setting-card-thumb setting-card-thumb--agent" aria-hidden="true">
                    <img
                      v-if="opt.thumbnail"
                      :src="opt.thumbnail"
                      :alt="opt.name"
                      class="setting-card-thumb__img"
                    />
                    <span v-else class="setting-card-thumb__letter">{{ (opt.name || '?').slice(0, 1) }}</span>
                  </div>
                  <div class="setting-card-body">
                    <div class="setting-card-title-row">
                      <span class="setting-card-title">{{ opt.name }}</span>
                      <span class="setting-card-tag">智能体</span>
                    </div>
                    <p v-if="opt.desc" class="setting-card-desc">{{ opt.desc }}</p>
                  </div>
                </button>
              </div>
            </template>

            <template v-if="modelOptions.length">
              <p class="setting-card-section-label">图片模型</p>
              <div class="setting-card-list">
                <button
                  v-for="opt in modelOptions"
                  :key="`model-${opt.id}`"
                  type="button"
                  class="setting-card-item"
                  role="menuitem"
                  :disabled="generating"
                  @click.stop="pickModel(opt)"
                >
                  <div
                    class="setting-card-thumb setting-card-thumb--model"
                    :style="{ background: opt.iconBg || '#10B981' }"
                    aria-hidden="true"
                  >
                    <img v-if="opt.icon" :src="opt.icon" :alt="opt.name" class="setting-card-thumb__img" />
                    <span v-else class="setting-card-thumb__letter">{{ (opt.name || '?').slice(0, 1) }}</span>
                  </div>
                  <div class="setting-card-body">
                    <div class="setting-card-title-row">
                      <span class="setting-card-title">{{ opt.name }}</span>
                      <span class="setting-card-tag">模型</span>
                    </div>
                    <p v-if="opt.desc" class="setting-card-desc">{{ opt.desc }}</p>
                  </div>
                </button>
              </div>
            </template>

            <div v-if="!agentOptions.length && !modelOptions.length" class="setting-card-empty">
              暂无可用智能体或模型
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import type { ModelOption } from './ModelSelectDropdown.vue'
import type { AgentOption } from './AgentPickerModal.vue'
import { aidAgentList } from '~/utils/businessApi'
import { useCreationStore } from '~/stores/creation'
import {
  CHARACTER_CARD_IMAGE_AGENT_BIZ_CATEGORY,
  agentOptionsFromGroup
} from '~/utils/extractAgentBiz'
import { getProjectGenConfigBySceneCode } from '~/utils/projectGenConfig'

const creationStore = useCreationStore()

const emit = defineEmits<{
  select: [payload: { agentCode?: string; modelCode?: string; imageIndex: number }]
}>()

const props = withDefaults(
  defineProps<{
    imageIndex: number
    isSupported: boolean
    isWhiteBaseReady: boolean
    disabled?: boolean
    generating?: boolean
  }>(),
  {
    imageIndex: 0,
    isSupported: false,
    isWhiteBaseReady: false,
    disabled: false,
    generating: false
  }
)

const ESTIMATED_PANEL_MIN = 220
const GAP = 8

const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const open = ref(false)
const openUpward = ref(false)
const readyToShowPanel = ref(false)
const panelFixedStyle = ref<Record<string, string>>({})

const loading = ref(false)
const agentOptions = ref<AgentOption[]>([])
const modelOptions = ref<ModelOption[]>([])

const panelStyle = computed(() => panelFixedStyle.value)

function mapModelRow(item: {
  id?: number | string
  modelCode?: string | null
  modelName?: string | null
  providerName?: string | null
}): ModelOption {
  const code = String(item.modelCode || '').trim()
  const sid = Number(item.id)
  return {
    id: code || String(item.id),
    serverModelId: Number.isFinite(sid) && sid > 0 ? sid : undefined,
    name: item.modelName || code || '未命名模型',
    iconBg: '#10B981',
    desc: item.providerName ? `服务商：${item.providerName}` : '',
    prices: []
  }
}

async function loadOptions() {
  loading.value = true
  try {
    const projectId = Number(creationStore.currentProjectId)
    let cfgModels: Awaited<ReturnType<typeof getProjectGenConfigBySceneCode>> = null
    if (Number.isFinite(projectId) && projectId > 0) {
      try {
        cfgModels = await getProjectGenConfigBySceneCode(
          projectId,
          CHARACTER_CARD_IMAGE_AGENT_BIZ_CATEGORY
        )
      } catch {
        cfgModels = null
      }
    }

    const groups = await aidAgentList({
      bizCategoryCodes: [CHARACTER_CARD_IMAGE_AGENT_BIZ_CATEGORY]
    })
    agentOptions.value = agentOptionsFromGroup(groups, CHARACTER_CARD_IMAGE_AGENT_BIZ_CATEGORY)

    const pool = cfgModels?.availableModels ?? []
    modelOptions.value = pool
      .map(mapModelRow)
      .filter((m) => String(m.id || '').trim())
  } catch {
    agentOptions.value = []
    modelOptions.value = []
  } finally {
    loading.value = false
  }
}

function pickAgent(opt: AgentOption) {
  if (props.generating) return
  const agentCode = String(opt?.id || '').trim()
  if (!agentCode) return
  emit('select', { agentCode, imageIndex: props.imageIndex })
  open.value = false
}

function pickModel(opt: ModelOption) {
  if (props.generating) return
  const modelCode = String(opt?.id || '').trim()
  if (!modelCode) return
  emit('select', { modelCode, imageIndex: props.imageIndex })
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
      if (props.isSupported && props.isWhiteBaseReady) {
        void loadOptions()
      }
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
.setting-card-popover-root {
  display: inline-flex;
  vertical-align: middle;
}

.setting-card-popover-trigger {
  display: inline-flex;
}

.setting-card-popover-trigger.is-disabled {
  cursor: not-allowed;
}

.setting-card-panel {
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

.setting-card-panel.is-open-down {
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
}

.setting-card-panel.is-open-up {
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
}

.setting-card-alert {
  flex-shrink: 0;
  margin-bottom: 0;
}

.setting-card-scroll {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  margin: 0 -2px;
  padding: 0 2px 2px;
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 140, 170, 0.4) transparent;
}

.setting-card-scroll::-webkit-scrollbar {
  width: 4px;
}

.setting-card-scroll::-webkit-scrollbar-thumb {
  background: rgba(120, 140, 170, 0.35);
  border-radius: 4px;
}

.setting-card-section-label {
  flex-shrink: 0;
  margin: 6px 0 4px;
  padding: 0 2px;
  font-size: 12px;
  font-weight: 600;
  color: #8e97a5;
}

.setting-card-section-label:first-of-type {
  margin-top: 0;
}

.setting-card-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-card-empty {
  padding: 12px 8px;
  font-size: 13px;
  color: #8e97a5;
  text-align: center;
}

.setting-card-item {
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

.setting-card-item:hover:not(:disabled) {
  background: rgba(74, 231, 253, 0.08);
}

.setting-card-item:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.setting-card-thumb {
  position: relative;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a2233;
}

.setting-card-thumb--agent {
  background: linear-gradient(135deg, #2a3550 0%, #3d4a68 100%);
}

.setting-card-thumb--model {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.setting-card-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.setting-card-thumb__letter {
  line-height: 1;
  font-weight: 600;
}

.setting-card-body {
  flex: 1;
  min-width: 0;
}

.setting-card-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
}

.setting-card-title {
  color: #f1f5ff;
}

.setting-card-tag {
  font-size: 12px;
  font-weight: 500;
  color: #a8b4c8;
}

.setting-card-desc {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: #8e97a5;
}

.setting-card-fade-enter-active,
.setting-card-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.setting-card-fade-enter-from,
.setting-card-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.setting-card-panel.is-open-up.setting-card-fade-enter-from,
.setting-card-panel.is-open-up.setting-card-fade-leave-to {
  transform: translateY(-4px);
}
</style>
