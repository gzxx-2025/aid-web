<template>
  <div ref="rootRef" class="model-select-dropdown">
    <!-- 当前选中的模型（可点击展开） -->
    <div
      ref="triggerRef"
      class="selected-model"
      :class="{
        expanded: expanded,
        'is-open-down': expanded && !openUpward,
        'is-open-up': expanded && openUpward
      }"
      @click="$emit('toggle')"
    >
      <div class="model-preview">
        <div v-if="hasSelectedModel" class="model-icon-wrapper">
          <img
            v-if="value.icon"
            :src="value.icon"
            :alt="value.name"
            class="model-icon"
          />
          <div v-else class="model-icon placeholder" :style="{ background: value.iconBg || '#10B981' }">
            {{ value.name?.slice(0, 1) || '?' }}
          </div>
        </div>
        <div class="model-info">
          <div class="model-name" :class="{ 'is-placeholder': !hasSelectedModel }">
            {{ value.name || '请选择模型' }}
          </div>
        </div>
      </div>
      <DownOutlined v-if="!expanded" class="expand-icon" />
      <UpOutlined v-else class="expand-icon" />
    </div>

    <!-- 下拉列表：挂到 body + fixed，避免在 overflow 容器内撑高滚动区、把底部按钮顶下去 -->
    <Teleport to="body">
      <Transition name="dropdown">
        <div
          v-if="expanded && readyToShowList"
          ref="optionsListRef"
          class="options-list"
          :class="{ 'is-open-down': !openUpward, 'is-open-up': openUpward }"
          :style="optionsListStyle"
        >
          <div
            v-for="option in options"
            :key="option.id"
            class="option-item"
            :class="{ selected: value.id === option.id }"
            @click="$emit('select', option)"
          >
            <div class="option-left">
              <div class="model-icon-wrapper">
                <img
                  v-if="option.icon"
                  :src="option.icon"
                  :alt="option.name"
                  class="model-icon"
                />
                <div v-else class="model-icon placeholder" :style="{ background: option.iconBg || '#10B981' }">
                  {{ option.name?.slice(0, 1) || '?' }}
                </div>
              </div>
            </div>
            <div class="option-right">
              <div class="option-header">
                <div class="option-name-row">
                  <span class="option-name">{{ option.name }}</span>
                  <span v-if="option.tag" class="option-tag" :class="option.tagType || 'default'">
                    {{ option.tag }}
                  </span>
                </div>
                <CheckCircleFilled v-if="value.id === option.id" class="check-icon" />
              </div>
              <div v-if="option.desc" class="option-desc">{{ option.desc }}</div>
              <div v-if="option.prices && option.prices.length > 0" class="option-prices">
                <span
                  v-for="(price, index) in option.prices"
                  :key="index"
                  class="price-item"
                >
                  {{ price.resolution }} {{ price.cost }}/张
                </span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { DownOutlined, UpOutlined, CheckCircleFilled } from '@ant-design/icons-vue'

export interface ModelOption {
  /**
   * 与接口一致的模型编码（如 wan2.7-image），用于 modelCode 类入参。
   * 勿用服务端数字主键，否则多机位/生图等会误传 "5" 这类值。
   */
  id: string
  name: string
  icon?: string
  iconBg?: string
  tag?: string
  tagType?: 'best' | 'cost-effective' | 'default'
  desc?: string
  prices?: Array<{ resolution: string; cost: number }>
  /** POST /api/user/storyboard/generate/media 等仍要求 modelId 时使用 */
  serverModelId?: number
}

interface Props {
  value: ModelOption
  options: ModelOption[]
  expanded: boolean
}

const props = defineProps<Props>()

const hasSelectedModel = computed(() => Boolean(String(props.value.id || '').trim()))

const emit = defineEmits<{
  toggle: []
  select: [model: ModelOption]
  /** 点击组件外部时关闭，行为对齐 Ant Select */
  close: []
}>()

/** 预估菜单最小高度，用于判断是否该向上展开 */
const ESTIMATED_MENU_MIN = 280

const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const optionsListRef = ref<HTMLElement | null>(null)
const openUpward = ref(false)
const menuMaxHeightPx = ref(500)
/** 先计算上下方向再渲染列表，避免首帧方向错误 */
const readyToShowList = ref(false)
/** fixed 定位（相对视口），与触发条对齐 */
const panelFixedStyle = ref<Record<string, string>>({})

const optionsListStyle = computed(() => ({
  ...panelFixedStyle.value,
  maxHeight: `${menuMaxHeightPx.value}px`
}))

function updateDropdownPlacement() {
  if (!props.expanded || !triggerRef.value) return

  const rect = triggerRef.value.getBoundingClientRect()
  const gap = 8
  const spaceBelow = window.innerHeight - rect.bottom - gap
  const spaceAbove = rect.top - gap

  // 下方空间足够则向下；否则若上方更宽裕则向上；否则选空间更大的一侧
  let upward = false
  if (spaceBelow >= ESTIMATED_MENU_MIN) {
    upward = false
  } else if (spaceAbove >= ESTIMATED_MENU_MIN) {
    upward = true
  } else {
    upward = spaceAbove > spaceBelow
  }

  openUpward.value = upward
  const avail = upward ? spaceAbove : spaceBelow
  menuMaxHeightPx.value = Math.max(120, Math.min(500, Math.floor(avail)))

  const minW = 360
  const widthPx = Math.min(Math.max(rect.width, minW), Math.min(520, window.innerWidth - 24))
  let leftPx = rect.left
  leftPx = Math.max(12, Math.min(leftPx, window.innerWidth - widthPx - 12))

  const z = '5000'

  if (!upward) {
    panelFixedStyle.value = {
      position: 'fixed',
      left: `${leftPx}px`,
      top: `${rect.bottom + gap}px`,
      width: `${widthPx}px`,
      zIndex: z
    }
  } else {
    panelFixedStyle.value = {
      position: 'fixed',
      left: `${leftPx}px`,
      bottom: `${window.innerHeight - rect.top + gap}px`,
      width: `${widthPx}px`,
      zIndex: z
    }
  }
}

function onViewportChange() {
  if (props.expanded) {
    updateDropdownPlacement()
  }
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
    const el = rootRef.value
    const listEl = optionsListRef.value
    if (!el || !props.expanded) return
    const target = e.target as Node | null
    if (target && (el.contains(target) || (listEl && listEl.contains(target)))) return
    emit('close')
  }
  document.addEventListener('mousedown', docMouseDownHandler, true)
}

watch(
  () => props.expanded,
  async (open) => {
    if (open) {
      readyToShowList.value = false
      unbindClickOutside()
      await nextTick()
      updateDropdownPlacement()
      readyToShowList.value = true
      await nextTick()
      bindClickOutside()
    } else {
      openUpward.value = false
      readyToShowList.value = false
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
.model-select-dropdown {
  position: relative;
  width: 100%;
}

.selected-model {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--create-surface-input, rgba(28, 38, 54, 0.92));
  border: 1px solid var(--gray-200, rgba(96, 124, 158, 0.22));
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  height: 40px;
  box-sizing: border-box;
}

.selected-model:hover {
  border-color: rgba(120, 140, 170, 0.45);
  box-shadow: none;
}

.selected-model.expanded {
  border-color: var(--accent-500, #4ae7fd);
  background: var(--create-surface-panel, rgba(38, 50, 72, 0.94));
}

/* 向下展开：与下方列表衔接，去掉下圆角 */
.selected-model.expanded.is-open-down {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

/* 向上展开：与上方列表衔接，去掉上圆角 */
.selected-model.expanded.is-open-up {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

.model-preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.model-icon-wrapper {
  flex-shrink: 0;
}

.model-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(6, 10, 18, 0.55);
}

.model-icon.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 1rem;
}

.model-info {
  flex: 1;
  min-width: 0;
}

.model-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--home-text, #e6edf3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.model-name.is-placeholder {
  color: var(--home-muted, #8e97a5);
  font-weight: 400;
}

.expand-icon {
  font-size: 0.75rem;
  color: var(--home-muted, #8e97a5);
  flex-shrink: 0;
  margin-left: 0.5rem;
}

/* 实际定位由 panelFixedStyle（position:fixed + top/left/width）内联控制，见 script */
.options-list {
  box-sizing: border-box;
  background: #12161d;
  border: 1px solid rgba(78, 94, 122, 0.38);
  overflow-y: auto;
  box-shadow: none;
  padding: 6px 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 140, 170, 0.45) transparent;
}

.options-list::-webkit-scrollbar {
  width: 6px;
}

.options-list::-webkit-scrollbar-thumb {
  background: rgba(120, 140, 170, 0.4);
  border-radius: 6px;
}

/* 向下：与触发条视觉上衔接（触发条底部圆角由 GenerateModelConfigBlock 覆盖） */
.options-list.is-open-down {
  border-top: none;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
}

/* 向上展开 */
.options-list.is-open-up {
  border-bottom: none;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}

.option-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 14px 16px;
  margin: 0 8px 8px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease;
  border: 1px solid transparent;
}

.option-item:last-child {
  margin-bottom: 6px;
}

.option-item:hover {
  background: rgba(74, 231, 253, 0.07);
  border-color: rgba(74, 231, 253, 0.12);
  box-shadow: none;
}

.option-item.selected {
  background: rgba(74, 231, 253, 0.1);
  border-color: rgba(74, 231, 253, 0.18);
}

.option-left {
  flex-shrink: 0;
  padding-top: 2px;
}

.options-list .model-icon {
  width: 32px;
  height: 32px;
  font-size: 0.8125rem;
}

.option-right {
  flex: 1;
  min-width: 180px;
}

.option-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 0;
}

.option-name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  flex: 1;
  min-width: 0;
}

.option-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--home-text, #e6edf3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.option-tag {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
  font-weight: 500;
  white-space: nowrap;
}

.option-tag.best {
  background: rgba(251, 191, 36, 0.18);
  color: #fcd34d;
  border: 1px solid rgba(251, 191, 36, 0.28);
}

.option-tag.cost-effective {
  background: rgba(167, 139, 250, 0.2);
  color: #c4b5fd;
  border: 1px solid rgba(167, 139, 250, 0.3);
}

.option-tag.default {
  background: rgba(255, 255, 255, 0.08);
  color: var(--home-muted, #8e97a5);
}

.option-desc {
  font-size: 0.8125rem;
  color: rgba(188, 205, 228, 0.78);
  line-height: 1.55;
  margin-top: 8px;
  margin-bottom: 10px;
}

.option-prices {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.price-item {
  font-size: 0.6875rem;
  color: rgba(216, 230, 252, 0.85);
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(120, 140, 170, 0.22);
  border-radius: 6px;
}

.check-icon {
  font-size: 1rem;
  color: var(--accent-500, #4ae7fd);
  flex-shrink: 0;
}

/* 下拉动画（向下：从上缘展开；向上：从下缘展开） */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.options-list.is-open-down.dropdown-enter-active,
.options-list.is-open-down.dropdown-leave-active {
  transform-origin: top center;
}

.options-list.is-open-up.dropdown-enter-active,
.options-list.is-open-up.dropdown-leave-active {
  transform-origin: bottom center;
}

.dropdown-enter-from {
  opacity: 0;
  transform: scaleY(0.96);
}

.dropdown-leave-to {
  opacity: 0;
  transform: scaleY(0.96);
}
</style>
