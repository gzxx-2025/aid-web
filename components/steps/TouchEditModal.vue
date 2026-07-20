<template>
  <a-modal
    :open="open"
    :width="'100vw'"
    :style="{ top: 0, paddingBottom: 0, maxWidth: '100vw' }"
    :footer="null"
    :closable="false"
    :maskClosable="false"
    wrap-class-name="create-flow-modal touch-edit-modal-wrap"
    class="touch-edit-modal"
    @cancel="emit('update:open', false)"
  >
    <div class="touch-edit">
      <div class="touch-edit__stage">
        <div class="touch-edit__canvas-wrap">
          <div
            ref="viewportRef"
            :class="[
              'touch-edit__viewport',
              scale > 1 ? (dragging ? 'is-grabbing' : 'is-grab') : ''
            ]"
            @mouseenter="handleViewportEnter"
            @mouseleave="handleViewportLeave"
            @wheel.prevent="handleWheel"
            @mousedown="handleMouseDown"
            @mousemove="handleMouseMove"
            @mouseup="handleMouseUp"
            @click="handleImageClick"
          >
            <img
              ref="imageRef"
              class="touch-edit__image"
              :src="imageUrl"
              alt=""
              :style="imageStyle"
              @load="handleMainImageLoad"
              draggable="false"
            />

            <div
              v-for="(mark, index) in marks"
              :key="mark.id"
              class="touch-edit__mark"
              :style="overlayStyle(mark.x, mark.y)"
            >
              <span>{{ index + 1 }}</span>
            </div>

            <div
              v-if="showHoverTooltip && hoverPos"
              class="touch-edit__tip"
              :style="overlayStyle(hoverPos.x, hoverPos.y)"
            >
              点击区域进行编辑
            </div>
          </div>
          <img src="@/assets/img/icon/close.svg" alt="" class="close-icon" @click="emit('update:open', false)">
        </div>

        <aside class="touch-edit__side">
          <div class="touch-edit__tags">
            <div
              v-for="tag in marks"
              :key="tag.id"
              class="touch-edit__tag"
              @mouseenter="handleTagMouseEnter(tag.id, $event)"
              @mouseleave="handleTagMouseLeave"
            >
              <div class="touch-edit__tag-thumb-wrap">
                <div class="touch-edit__tag-thumb">
                  <div
                    class="touch-edit__tag-thumb-img"
                    :style="previewBgStyle(tag.x, tag.y, thumbZoom, 24, tag.zoomed)"
                  />
                </div>
              </div>
              <div class="touch-edit__tag-order">{{ tag.order }}</div>
              <div v-if="tag.loading" class="touch-edit__tag-loading" />
              <div v-else class="touch-edit__tag-name">{{ tag.name }}</div>

              <Teleport to="body">
                <div
                  v-if="hoverTagId === tag.id"
                  class="touch-edit__hover-preview"
                  :style="{
                    left: `${hoverPreviewPos.left}px`,
                    top: `${hoverPreviewPos.top}px`
                  }"
                >
                  <div
                    class="touch-edit__hover-preview-img"
                    :style="previewBgStyle(tag.x, tag.y, previewZoom, 180, hoverPreviewZoomed)"
                  />
                </div>
              </Teleport>
            </div>
          </div>
          <div class="touch-edit__input-wrap">
            <textarea
              v-model="instructionText"
              class="touch-edit__input"
              placeholder="拖动框并修改您的指令内容，如：将画面中男子的头发改成白色"
            />
          </div>
          <button type="button" class="touch-edit__submit-btn">
            <img src="@/assets/img/icon/star_white.svg" alt="">
            <span>开始生成</span>
          </button>
        </aside>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { userTouchEditPointDetect } from '~/utils/businessApi'

interface TouchMark {
  id: string
  order: number
  x: number
  y: number
  zoomed: boolean
  loading: boolean
  name: string
}

const props = defineProps<{
  open: boolean
  imageUrl: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const viewportRef = ref<HTMLDivElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const instructionText = ref('')
const marks = ref<TouchMark[]>([])
const hoverTagId = ref<string | null>(null)
const hoverPreviewZoomed = ref(false)
const hoverPreviewPos = ref({ left: 28, top: 120 })
const viewportHovering = ref(false)
const hoverPos = ref<{ x: number; y: number } | null>(null)

const scale = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)
const dragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const naturalSize = ref({ w: 0, h: 0 })

const imageStyle = computed(() => ({
  transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value})`
}))

const thumbZoom = 3.6
const previewZoom = 4.2

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function handleMainImageLoad() {
  const imgEl = imageRef.value
  if (!imgEl) return
  naturalSize.value = {
    w: imgEl.naturalWidth || 0,
    h: imgEl.naturalHeight || 0
  }
}

function previewBgStyle(
  xRaw: number,
  yRaw: number,
  zoomRaw: number,
  sizePx: number,
  focused: boolean
) {
  const x = clamp(xRaw, 0, 1)
  const y = clamp(yRaw, 0, 1)
  const zoom = focused ? Math.max(1.01, zoomRaw) : 1
  const imgEl = imageRef.value
  const w = naturalSize.value.w || imgEl?.naturalWidth || 0
  const h = naturalSize.value.h || imgEl?.naturalHeight || 0
  if (!props.imageUrl || !w || !h) {
    return {
      backgroundImage: `url(${props.imageUrl})`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
      backgroundPosition: '50% 50%'
    }
  }

  const baseScale = Math.max(sizePx / w, sizePx / h)
  const renderW = w * baseScale * zoom
  const renderH = h * baseScale * zoom

  // 让点击点尽量处于预览中心，超边界时做钳制
  let left = sizePx / 2 - x * renderW
  let top = sizePx / 2 - y * renderH
  left = clamp(left, sizePx - renderW, 0)
  top = clamp(top, sizePx - renderH, 0)

  return {
    backgroundImage: `url(${props.imageUrl})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${renderW}px ${renderH}px`,
    backgroundPosition: `${left}px ${top}px`
  }
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    marks.value = []
    instructionText.value = ''
    hoverTagId.value = null
    viewportHovering.value = false
    hoverPos.value = null
    scale.value = 1
    offsetX.value = 0
    offsetY.value = 0

    // 双保险：有些缓存图不会稳定触发 onload，这里在弹窗打开时主动同步一次原图尺寸
    await nextTick()
    const imgEl = imageRef.value
    if (imgEl?.complete && imgEl.naturalWidth && imgEl.naturalHeight) {
      naturalSize.value = {
        w: imgEl.naturalWidth,
        h: imgEl.naturalHeight
      }
    }
  }
)

watch(
  () => props.imageUrl,
  () => {
    naturalSize.value = { w: 0, h: 0 }
  }
)

// 提示文案始终跟随手势展示（点击后也不消失）；拖拽时隐藏避免干扰
const showHoverTooltip = computed(() => viewportHovering.value && !dragging.value)

function clampScale(v: number) {
  return Math.min(4, Math.max(0.6, v))
}

function handleWheel(event: WheelEvent) {
  const next = scale.value + (event.deltaY < 0 ? 0.12 : -0.12)
  scale.value = clampScale(next)
}

function handleMouseDown(event: MouseEvent) {
  if (scale.value <= 1) return
  dragging.value = true
  dragStartX.value = event.clientX - offsetX.value
  dragStartY.value = event.clientY - offsetY.value
}

function handleMouseMove(event: MouseEvent) {
  // hover tip：始终跟随鼠标（只要在图片区域内）
  const imgEl = imageRef.value
  if (imgEl && viewportHovering.value) {
    const rect = imgEl.getBoundingClientRect()
    const m = getImageContentMetrics()
    if (!m) return
    const localX = event.clientX - rect.left
    const localY = event.clientY - rect.top
    const x = (localX - m.offsetX) / m.contentW
    const y = (localY - m.offsetY) / m.contentH
    if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x <= 1 && y <= 1) {
      hoverPos.value = { x, y }
    } else {
      hoverPos.value = null
    }
  }
  if (!dragging.value) return
  offsetX.value = event.clientX - dragStartX.value
  offsetY.value = event.clientY - dragStartY.value
}

function handleMouseUp() {
  dragging.value = false
}

function handleViewportEnter() {
  viewportHovering.value = true
}

function handleViewportLeave() {
  viewportHovering.value = false
  hoverPos.value = null
}

function handleTagMouseEnter(tagId: string, event: MouseEvent) {
  hoverTagId.value = tagId
  hoverPreviewZoomed.value = false
  const target = event.currentTarget as HTMLElement | null
  if (target && typeof window !== 'undefined') {
    const rect = target.getBoundingClientRect()
    const previewW = 180
    const previewH = 180
    const gap = 10
    let left = rect.left + rect.width / 2 - previewW / 2
    let top = rect.top - previewH - gap
    if (top < 8) top = rect.bottom + gap
    left = Math.max(8, Math.min(left, window.innerWidth - previewW - 8))
    top = Math.max(8, Math.min(top, window.innerHeight - previewH - 8))
    hoverPreviewPos.value = { left, top }
  }
  requestAnimationFrame(() => {
    if (hoverTagId.value === tagId) {
      hoverPreviewZoomed.value = true
    }
  })
}

function handleTagMouseLeave() {
  hoverTagId.value = null
  hoverPreviewZoomed.value = false
}

function toFixedCoord(v: number) {
  return Number(v.toFixed(5))
}

function getImageContentMetrics() {
  const imgEl = imageRef.value
  if (!imgEl) return null
  // 注意：图片在 viewport 内会做 translate/scale 变换。
  // 坐标换算必须与事件里使用的 getBoundingClientRect() 保持同一坐标系，
  // 否则在缩放后会出现明显偏移。
  const rect = imgEl.getBoundingClientRect()
  const boxW = rect.width
  const boxH = rect.height
  const naturalW = imgEl.naturalWidth
  const naturalH = imgEl.naturalHeight
  if (!boxW || !boxH || !naturalW || !naturalH) return null

  const boxRatio = boxW / boxH
  const imgRatio = naturalW / naturalH

  let contentW = boxW
  let contentH = boxH
  let offsetX = 0
  let offsetY = 0

  if (imgRatio > boxRatio) {
    contentW = boxW
    contentH = boxW / imgRatio
    offsetY = (boxH - contentH) / 2
  } else {
    contentH = boxH
    contentW = boxH * imgRatio
    offsetX = (boxW - contentW) / 2
  }

  return { boxW, boxH, contentW, contentH, offsetX, offsetY }
}

function overlayStyle(nx: number, ny: number) {
  const m = getImageContentMetrics()
  if (!m) return { left: `${nx * 100}%`, top: `${ny * 100}%` }
  const leftPx = m.offsetX + nx * m.contentW
  const topPx = m.offsetY + ny * m.contentH
  return {
    left: `${(leftPx / m.boxW) * 100}%`,
    top: `${(topPx / m.boxH) * 100}%`
  }
}

async function handleImageClick(event: MouseEvent) {
  if (dragging.value) return
  if (!props.imageUrl) return
  const imgEl = imageRef.value
  if (!imgEl) return
  // 坐标按 object-fit: contain 后的真实可视区域换算，避免黑边偏移
  const rect = imgEl.getBoundingClientRect()
  const m = getImageContentMetrics()
  if (!m) return
  const localX = event.clientX - rect.left
  const localY = event.clientY - rect.top
  const x = (localX - m.offsetX) / m.contentW
  const y = (localY - m.offsetY) / m.contentH
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  if (x < 0 || y < 0 || x > 1 || y > 1) return

  const nx = toFixedCoord(x)
  const ny = toFixedCoord(y)
  const id = `touch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const nextOrder = marks.value.length + 1
  marks.value.push({
    id,
    order: nextOrder,
    x: nx,
    y: ny,
    zoomed: false,
    loading: true,
    name: ''
  })
  // 让缩略图先以“整图”出现，再过渡到“局部区域”
  requestAnimationFrame(() => {
    const idx = marks.value.findIndex((m) => m.id === id)
    if (idx >= 0) {
      marks.value[idx] = { ...marks.value[idx]!, zoomed: true }
    }
  })

  try {
    const prompt = `(${nx},${ny})`
    const res = await userTouchEditPointDetect({ image: props.imageUrl, prompt })
    const label = String(
      res?.name ||
        res?.label ||
        res?.objectName ||
        res?.data?.name ||
        res?.data?.label ||
        `区域${nextOrder}`
    )
    const idx = marks.value.findIndex((m) => m.id === id)
    if (idx >= 0) {
      marks.value[idx] = { ...marks.value[idx]!, loading: false, name: label }
    }
  } catch (e: unknown) {
    const idx = marks.value.findIndex((m) => m.id === id)
    if (idx >= 0) {
      marks.value[idx] = { ...marks.value[idx]!, loading: false, name: `区域${nextOrder}` }
    }
    const err = e as { msg?: string; message?: string }
    message.warning(err?.msg || err?.message || '识别失败，已使用默认名称')
  }
}
</script>

<style lang="scss">
.touch-edit-modal-wrap .ant-modal-content {
  padding: 0 !important;
}
</style>

<style scoped lang="scss">
.touch-edit {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 32px);
  background: #06080d;
}
.touch-edit__header {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.touch-edit__back {
  color: #8e97a5;
}
.touch-edit__close {
  width: 22px;
  height: 22px;
  border: 1px solid rgba(142, 151, 165, 0.45);
  border-radius: 4px;
  background: transparent;
  color: #8e97a5;
  cursor: pointer;
  line-height: 1;
}
.touch-edit__stage {
  flex: 1;
  min-height: 0;
  padding: 0 14px 14px;
  display: flex;
  gap: 12px;
}
.touch-edit__canvas-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  position: relative;
  .close-icon{
    position: absolute;
    right: 26px;
    top: 24px;
    cursor: pointer;
    width: 24px;
    height: 24px;
  }
}
.touch-edit__viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 10px;
  cursor: pointer;
  margin-top: 20px;
  display: flex;
  align-items: center;
}

.touch-edit__viewport:active {
  cursor: pointer;
}

.touch-edit__viewport.is-grab {
  cursor: grab;
}

.touch-edit__viewport.is-grabbing {
  cursor: grabbing;
}
.touch-edit__image {
  width: 100%;
  height:100%;
  object-fit: contain;
  user-select: none;
  transition: transform 0.08s linear;
  transform-origin: center center;
}
.touch-edit__mark {
  position: absolute;
  width: 24px;
  height: 24px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: linear-gradient( 270deg, #0E59FA 0%, #00ABD8 100%);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  z-index: 4;
  font-size: 14px;
}
.touch-edit__tip {
  position: absolute;
  transform: translate(12px, -28px);
  background: rgba(255, 255, 255, 0.95);
  color: #333 !important;
  border-radius: 999px;
  font-size: 12px;
  padding: 6px 12px;
}
.touch-edit__side {
  width: 400px;
  flex-shrink: 0;
  border-left: rgba(142, 151, 165, 0.2) 1px solid;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.touch-edit__tags {
  display: flex;
  gap: 8px;
  min-height: 30px;
  overflow-x: auto;
  flex-wrap: wrap;
  padding-bottom: 2px;
}
.touch-edit__tag {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(142, 151, 165, 0.3);
  border-radius: 8px;
  padding: 3px 8px 3px 3px;
  position: relative;
}
.touch-edit__tag-thumb-wrap {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}
.touch-edit__tag-thumb {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  overflow: hidden;
  background-color: rgba(74, 231, 253, 0.08);
  position: relative;
  transition: transform 0.18s ease;
  will-change: transform;
}
.touch-edit__tag:hover .touch-edit__tag-thumb {
  transform: scale(1.06);
}

.touch-edit__tag-thumb-img {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  transition:
    background-position 0.32s ease,
    background-size 0.32s ease;
  will-change: background-position, background-size;
  user-select: none;
}
.touch-edit__tag-order {
  font-weight: 700;
  font-size: 12px;
  width: 24px;
  height: 24px;
  text-align: center;
  line-height: 24px;
  background: linear-gradient( 270deg, #0E59FA 0%, #00ABD8 100%);
  border-radius: 999px;
}
.touch-edit__tag-name {
  color: #e6edf3;
  font-size: 12px;
}
.touch-edit__tag-loading {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid rgba(74, 231, 253, 0.35);
  border-top-color: #4ae7fd;
  animation: touch-spin 0.8s linear infinite;
}
@keyframes touch-spin {
  to {
    transform: rotate(360deg);
  }
}
.touch-edit__hover-preview {
  position: fixed;
  width: 180px;
  height: 180px;
  border-radius: 12px;
  border: 1px solid rgba(74, 231, 253, 0.45);
  overflow: hidden;
  z-index: 9999;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  background-color: rgba(6, 10, 18, 0.95);
  animation: touch-pop 0.18s ease;
}
@keyframes touch-pop {
  from {
    transform: scale(0.92);
    opacity: 0.4;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.touch-edit__hover-preview-img {
  position: absolute;
  inset: 0;
  transition:
    background-position 0.32s ease,
    background-size 0.32s ease;
  will-change: background-position, background-size;
  user-select: none;
}

.touch-edit__input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 8px;
  padding: 8px 10px;
  background: #0a101a;
}
.touch-edit__input {
  flex: 1;
  min-height: 120px;
  border-radius: 8px;
  border: none;
  outline: none;
  background: transparent;
  color: #d9e6f5;
  font-size: 13px;
  line-height: 1.5;
  resize: none;
}
.touch-edit__submit-btn {
  margin-top: auto;
  width: 100%;
  height: 38px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(90deg, #18c8ff 0%, #1f63ff 100%);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  img{
    width: 18px;
    height: 18px;
  }
}
</style>
