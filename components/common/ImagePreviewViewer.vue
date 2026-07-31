<template>
  <div
    class="image-preview-viewer"
    :class="{
      'image-preview-viewer--fill': fillStage,
      'image-preview-viewer--header-row': Boolean(headerTitle)
    }"
  >
    <div
      class="image-preview-viewer__chrome"
      :class="{ 'image-preview-viewer__chrome--header': Boolean(headerTitle) }"
    >
      <div
        v-if="headerTitle"
        class="image-preview-viewer__title"
        :title="headerTitle"
      >
        {{ headerTitle }}
      </div>
      <div class="image-preview-viewer__toolbar" role="toolbar" aria-label="图片预览工具">
        <button
          type="button"
          class="image-preview-viewer__tool-btn"
          aria-label="放大"
          title="放大"
          @click="zoomIn"
        >
          <ZoomInOutlined />
        </button>
        <button
          type="button"
          class="image-preview-viewer__tool-btn"
          aria-label="缩小"
          title="缩小"
          @click="zoomOut"
        >
          <ZoomOutOutlined />
        </button>
        <button
          type="button"
          class="image-preview-viewer__tool-btn"
          aria-label="旋转"
          title="旋转"
          @click="rotate"
        >
          <RotateRightOutlined />
        </button>
        <button
          type="button"
          class="image-preview-viewer__tool-btn image-preview-viewer__tool-btn--reset"
          aria-label="还原"
          title="还原"
          @click="reset"
        >
          <ReloadOutlined />
        </button>
      </div>
      <!-- 预留给弹窗右上角关闭图标，保持标题/工具条视觉居中 -->
      <div v-if="headerTitle" class="image-preview-viewer__header-trail" aria-hidden="true" />
    </div>

    <div
      ref="stageRef"
      class="image-preview-viewer__stage"
      :class="{ 'is-pannable': canPan, 'is-dragging': dragging }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @lostpointercapture="onPointerUp"
      @wheel.prevent="onWheel"
    >
      <div class="image-preview-viewer__canvas" :style="canvasStyle">
        <img
          ref="imgRef"
          class="image-preview-viewer__img"
          :src="resolvedUrl"
          :alt="alt"
          :style="imgBoundsStyle"
          draggable="false"
          @load="onImgLoad"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  RotateRightOutlined,
  ReloadOutlined
} from '@ant-design/icons-vue'

const props = withDefaults(
  defineProps<{
    url: string
    alt?: string
    maxHeight?: string
    /** 在弹窗壳内铺满可用高度（与批量生成分镜图弹窗内容区一致） */
    fillStage?: boolean
    /** fillStage 时图片默认占舞台的比例（0-1）；预览弹窗传 1 以撑满可视区 */
    stageFitRatio?: number
    /** 有值时标题与工具条同一行（左标题 / 中工具 / 右留白给关闭） */
    headerTitle?: string
  }>(),
  {
    alt: '预览',
    maxHeight: '66vh',
    fillStage: false,
    stageFitRatio: 1,
    headerTitle: ''
  }
)

const MIN_SCALE = 0.25
const MAX_SCALE = 4
const SCALE_STEP = 0.25
/** 判定为 16:9 的宽高比容差 */
const ASPECT_16_9 = 16 / 9
const ASPECT_16_9_TOLERANCE = 0.04

const stageRef = ref<HTMLElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)
const scale = ref(1)
const rotation = ref(0)
const panX = ref(0)
const panY = ref(0)
const dragging = ref(false)
const canPan = ref(false)
const baseSize = ref({ width: 0, height: 0 })
const imgBoundsStyle = ref<Record<string, string>>({})

let dragStart: { x: number; y: number; panX: number; panY: number } | null = null
let stageResizeObserver: ResizeObserver | null = null

const resolvedUrl = computed(() => String(props.url || '').trim())

const effectiveStageFitRatio = computed(() => {
  if (!props.fillStage) return 1
  const ratio = props.stageFitRatio
  if (!Number.isFinite(ratio)) return 1
  return Math.min(1, Math.max(0.35, ratio))
})

const canvasStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${scale.value}) rotate(${rotation.value}deg)`
}))

function isApprox16x9(width: number, height: number) {
  if (!width || !height) return false
  return Math.abs(width / height - ASPECT_16_9) <= ASPECT_16_9_TOLERANCE
}

function getRotatedBounds(width: number, height: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos
  }
}

function updatePanState() {
  const stage = stageRef.value
  const size = baseSize.value
  if (!stage || !size.width || !size.height) {
    canPan.value = false
    return
  }
  const scaled = {
    width: size.width * scale.value,
    height: size.height * scale.value
  }
  const bounds = getRotatedBounds(scaled.width, scaled.height, rotation.value)
  canPan.value =
    bounds.width > stage.clientWidth + 1 || bounds.height > stage.clientHeight + 1
}

function updateImgBoundsStyle() {
  const stage = stageRef.value
  const img = imgRef.value
  if (!stage || !props.fillStage) {
    imgBoundsStyle.value = {}
    return
  }
  const ratio = effectiveStageFitRatio.value
  const stageW = stage.clientWidth
  const stageH = stage.clientHeight
  // 舞台尚未布局完成时不要写成 1px，避免图片被压没
  if (stageW < 2 || stageH < 2) {
    imgBoundsStyle.value = {
      width: 'auto',
      height: 'auto',
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: 'contain'
    }
    return
  }
  const maxW = Math.max(1, Math.floor(stageW * ratio))
  const maxH = Math.max(1, Math.floor(stageH * ratio))
  const naturalW = img?.naturalWidth || 0
  const naturalH = img?.naturalHeight || 0

  // 16:9：铺满整个可视区域；其他比例：等比撑满且高度不超出
  if (naturalW && naturalH && isApprox16x9(naturalW, naturalH)) {
    imgBoundsStyle.value = {
      width: `${maxW}px`,
      height: `${maxH}px`,
      maxWidth: `${maxW}px`,
      maxHeight: `${maxH}px`,
      objectFit: 'cover'
    }
    return
  }

  imgBoundsStyle.value = {
    width: 'auto',
    height: 'auto',
    maxWidth: `${maxW}px`,
    maxHeight: `${maxH}px`,
    objectFit: 'contain'
  }
}

function measureBaseSize() {
  const img = imgRef.value
  if (!img) return
  baseSize.value = {
    width: img.clientWidth,
    height: img.clientHeight
  }
  updatePanState()
}

function onImgLoad() {
  nextTick(() => {
    updateImgBoundsStyle()
    measureBaseSize()
  })
}

function zoomIn() {
  scale.value = Math.min(MAX_SCALE, Number((scale.value + SCALE_STEP).toFixed(2)))
  updatePanState()
}

function zoomOut() {
  scale.value = Math.max(MIN_SCALE, Number((scale.value - SCALE_STEP).toFixed(2)))
  updatePanState()
  if (!canPan.value) {
    panX.value = 0
    panY.value = 0
  }
}

function applyZoomDelta(delta: number) {
  if (!delta) return
  scale.value = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, Number((scale.value + delta).toFixed(2)))
  )
  updatePanState()
  if (!canPan.value) {
    panX.value = 0
    panY.value = 0
  }
}

function onWheel(event: WheelEvent) {
  event.preventDefault()
  event.stopPropagation()
  if (!event.deltaY) return

  if (event.ctrlKey) {
    // 触摸板双指捏合缩放
    applyZoomDelta(-event.deltaY * 0.01)
    return
  }

  // 鼠标滚轮：按方向步进缩放
  applyZoomDelta(event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP)
}

function rotate() {
  rotation.value = (rotation.value + 90) % 360
  updatePanState()
}

function reset() {
  scale.value = 1
  rotation.value = 0
  panX.value = 0
  panY.value = 0
  nextTick(() => {
    updateImgBoundsStyle()
    measureBaseSize()
  })
}

function onPointerDown(event: PointerEvent) {
  if (!canPan.value || event.button !== 0) return
  dragging.value = true
  dragStart = {
    x: event.clientX,
    y: event.clientY,
    panX: panX.value,
    panY: panY.value
  }
  stageRef.value?.setPointerCapture(event.pointerId)
  event.preventDefault()
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value || !dragStart) return
  panX.value = dragStart.panX + (event.clientX - dragStart.x)
  panY.value = dragStart.panY + (event.clientY - dragStart.y)
  event.preventDefault()
}

function onPointerUp(event: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  dragStart = null
  try {
    stageRef.value?.releasePointerCapture(event.pointerId)
  } catch {}
}

watch(
  () => resolvedUrl.value,
  () => {
    scale.value = 1
    rotation.value = 0
    panX.value = 0
    panY.value = 0
    baseSize.value = { width: 0, height: 0 }
    imgBoundsStyle.value = {}
    canPan.value = false
  }
)

watch([scale, rotation], () => {
  updatePanState()
  if (!canPan.value) {
    panX.value = 0
    panY.value = 0
  }
})

onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !stageRef.value) return
  stageResizeObserver = new ResizeObserver(() => {
    updateImgBoundsStyle()
    nextTick(() => measureBaseSize())
  })
  stageResizeObserver.observe(stageRef.value)
})

onBeforeUnmount(() => {
  stageResizeObserver?.disconnect()
  stageResizeObserver = null
})

defineExpose({ reset, zoomIn, zoomOut, rotate })
</script>

<style scoped>
.image-preview-viewer {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.image-preview-viewer__chrome {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.image-preview-viewer__chrome--header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(2.75rem, 1fr);
  align-items: center;
  column-gap: 0.75rem;
  min-height: 2.5rem;
}

.image-preview-viewer__title {
  min-width: 0;
  color: var(--home-text, #e6edf3);
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-preview-viewer__toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.image-preview-viewer__header-trail {
  width: 2.75rem;
  height: 2.5rem;
  justify-self: end;
}

.image-preview-viewer__tool-btn {
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid rgba(74, 231, 253, 0.22);
  border-radius: 8px;
  background: rgba(8, 11, 18, 0.85);
  color: #e6edf3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1rem;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.image-preview-viewer__tool-btn:hover {
  background: rgba(74, 231, 253, 0.14);
  border-color: rgba(74, 231, 253, 0.45);
  color: #4ae7fd;
}

.image-preview-viewer__tool-btn--reset {
  margin-left: 0.25rem;
}

.image-preview-viewer--fill {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  gap: 0.5rem;
}

.image-preview-viewer--fill .image-preview-viewer__chrome {
  flex-shrink: 0;
}

.image-preview-viewer--fill .image-preview-viewer__stage {
  flex: 1 1 0;
  min-height: 0 !important;
  max-height: none !important;
  width: 100%;
  height: auto;
  padding: 0;
  border-radius: 0;
}

.image-preview-viewer--fill .image-preview-viewer__canvas {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  max-height: 100%;
}

.image-preview-viewer--fill .image-preview-viewer__img {
  max-height: none;
}

.image-preview-viewer__stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  max-height: 70vh;
  overflow: hidden;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 8px;
  touch-action: none;
  user-select: none;
  cursor: default;
}

.image-preview-viewer__stage.is-pannable {
  cursor: grab;
}

.image-preview-viewer__stage.is-dragging {
  cursor: grabbing;
}

.image-preview-viewer__canvas {
  transform-origin: center center;
  transition: transform 0.2s ease;
  will-change: transform;
}

.image-preview-viewer__stage.is-dragging .image-preview-viewer__canvas {
  transition: none;
}

.image-preview-viewer__img {
  display: block;
  max-width: 100%;
  max-height: v-bind(maxHeight);
  width: auto;
  height: auto;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}
</style>
