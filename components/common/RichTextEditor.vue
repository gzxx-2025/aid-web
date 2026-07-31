<template>
  <div
    class="rich-text-editor"
    :class="[
      wrapperClass,
      { 'is-inputting': isInputting, 'rich-text-editor--lock-char-keys': lockCharacterSettingKeys }
    ]"
    :style="rootStyle"
  >
    <div ref="hostRef" class="rich-text-editor__host" />
    <div
      v-if="showCount && maxLength != null"
      class="rich-text-editor__count"
      :class="{ 'rich-text-editor__count--limit': plainLength >= maxLength }"
    >
      {{ plainLength }}/{{ maxLength }}
    </div>
    <PromptAssetRefPicker
      v-if="enablePromptAssetRefs"
      :open="pickerOpen"
      :assets="pickerPromptAssets"
      :selected-asset-id="pickerSelectedAssetId"
      :anchor-rect="pickerAnchorRect"
      @close="closeAssetPicker"
      @select="onPickerSelectAsset"
    />
    <PromptParamRefPicker
      v-if="enablePromptParamRefs"
      :open="paramPickerOpen"
      :options="paramPickerOptions"
      :selected-key="paramPickerSelectedKey"
      :anchor-rect="paramPickerAnchorRect"
      @close="closeParamPicker"
      @select="onParamPickerSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed, useAttrs, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import {
  htmlPlainTextLength,
  htmlPureTextCharCount,
  htmlToPlainText,
  plainPureTextCharCount
} from '~/utils/htmlPlain'
import { registerCharacterSettingProtectedBlots } from '~/utils/quill/characterSettingProtectedBlots'
import {
  registerPromptAssetRefBlot,
  readPromptAssetRefFromNode
} from '~/utils/quill/promptAssetRefBlot'
import { registerPromptParamRefBlot } from '~/utils/quill/promptParamRefBlot'
import {
  createAsyncMountGate,
  createQuillSafely,
  shouldProceedQuillMount
} from '~/utils/quill/quillMountGuard'
import PromptAssetRefPicker from '~/components/common/PromptAssetRefPicker.vue'
import PromptParamRefPicker from '~/components/common/PromptParamRefPicker.vue'
import {
  dedupePromptAssets,
  extractReferencedAssetIdsFromHtml,
  extractReferencedImageIndexesFromHtml,
  formatAssetApiPlaceholder,
  isEmptyPromptAssetUrl,
  plainTextLengthForPrompt,
  promptAssetItemToRefValue,
  storyboardPromptHtmlToPlain,
  storyboardPromptPlainToHtml,
  type PromptAssetItem,
  type PromptAssetRefValue
} from '~/utils/storyboardPromptAssetRef'
import {
  findParamGroup,
  paramRefsEqual,
  plainHasImageLabeledParamFields,
  plainHasVideoLabeledParamFields,
  readPromptParamRefFromNode,
  selectionToParamRef,
  type PromptParamGroup,
  type PromptParamOption,
  type PromptParamRefValue,
  type PromptParamType
} from '~/utils/storyboardPromptParamRef'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    maxLength?: number
    minHeight?: string
    maxHeight?: string
    showCount?: boolean
    disabled?: boolean
    /**
     * 角色设定：锁定小节标题与基本信息各字段标签行（均为 `scp-char-setting-section` 原子 Embed）；
     * 旧数据中的 `scp-char-setting-key` 仍兼容。
     */
    lockCharacterSettingKeys?: boolean
    /** 分镜图描述：@图片 引用以整块展示，可点击切换 */
    enablePromptAssetRefs?: boolean
    promptAssets?: PromptAssetItem[]
    /** 分镜图描述：@构图 / @景别 等参数引用，可点击切换（无缩略图） */
    enablePromptParamRefs?: boolean
    promptParamGroups?: PromptParamGroup[]
    /** 字数统计与 maxLength 校验仅计纯文字（汉字/字母/数字，不含空格与标点） */
    countPureTextOnly?: boolean
    /** 达到 maxLength 且继续输入时的提示文案；不传则使用默认提示 */
    maxLengthWarning?: string
  }>(),
  {
    placeholder: '',
    minHeight: '120px',
    showCount: false,
    disabled: false,
    lockCharacterSettingKeys: false,
    enablePromptAssetRefs: false,
    promptAssets: () => [],
    enablePromptParamRefs: false,
    promptParamGroups: () => [],
    countPureTextOnly: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  promptParamChange: [
    payload: { paramType: PromptParamType; selection: { key: string; value: string } | null }
  ]
}>()

const wrapperClass = computed(() => attrs.class)
const rootStyle = computed(() => ({
  ...(attrs.style as Record<string, string> | undefined),
  '--rte-min-height': props.minHeight,
  '--rte-max-height': props.maxHeight ?? 'none'
}))

const hostRef = ref<HTMLElement | null>(null)
let quill: import('quill').default | null = null
const isReady = ref(false)
const isInputting = ref(false)
let skipWatchUpdate = false
let syncingFromProp = false
/** 插入 @ 引用后待恢复的光标位置（applyHtml / v-model 回写会重置 Quill 选区） */
let pendingCaretIndex: number | null = null
let lastEmittedPromptHtml: string | null = null
let cleanupEditorInputListeners: (() => void) | null = null
let cleanupAssetRefClick: (() => void) | null = null
let QuillCtor: typeof import('quill').default | null = null
/** Tab v-if 卸载时作废进行中的 import('quill')，防止 Invalid Quill container → 整页 500 */
const mountGate = createAsyncMountGate()

const pickerOpen = ref(false)
const pickerAnchorRect = ref<DOMRect | null>(null)
const pickerSelectedAssetId = ref<string | undefined>(undefined)
let activeAssetBlotIndex: number | null = null

const paramPickerOpen = ref(false)
const paramPickerAnchorRect = ref<DOMRect | null>(null)
const paramPickerOptions = ref<PromptParamOption[]>([])
const paramPickerSelectedKey = ref<string | undefined>(undefined)
let activeParamBlotIndex: number | null = null
let activeParamType: PromptParamType | null = null

const plainLength = computed(() => {
  if (props.enablePromptAssetRefs) {
    return plainTextLengthForPrompt(props.modelValue)
  }
  if (props.countPureTextOnly) {
    return htmlPureTextCharCount(props.modelValue)
  }
  return htmlPlainTextLength(props.modelValue)
})

/** 下拉选择器展示用：合并后的资产列表可能含重复项，按 id/name 去重 */
/** 点选图片 chip 只列图片；点选音频 chip 只列音频（不播放） */
const pickerPromptAssets = computed(() => {
  const all = dedupePromptAssets(props.promptAssets)
  const selected = all.find((a) => a.assetId === pickerSelectedAssetId.value)
  if (selected?.assetType === 'audio') {
    return all.filter((a) => a.assetType === 'audio')
  }
  return all.filter((a) => a.assetType !== 'audio')
})

/** 是否仅有空白（含 @图片 / @参数 引用块时视为非空） */
function isQuillTextEmpty(q: import('quill').default): boolean {
  if (props.enablePromptAssetRefs || props.enablePromptParamRefs) {
    for (const op of q.getContents().ops) {
      const ins = op.insert
      if (ins != null && typeof ins === 'object') {
        if ('promptAssetRef' in ins || 'promptParamRef' in ins) return false
      }
      if (typeof ins === 'string' && ins.replace(/\s/g, '').length > 0) {
        return false
      }
    }
    return true
  }
  const t = q.getText()
  const len = t.endsWith('\n') ? Math.max(0, t.length - 1) : t.length
  return len === 0
}

function getPlainLen(q: import('quill').default): number {
  if (props.enablePromptAssetRefs) {
    return storyboardPromptHtmlToPlain(q.getSemanticHTML()).length
  }
  const t = q.getText()
  const text = t.endsWith('\n') ? t.slice(0, -1) : t
  if (props.countPureTextOnly) {
    return plainPureTextCharCount(text)
  }
  return text.length
}

let maxLengthWarnCooldown = false
function warnMaxLengthReached() {
  if (maxLengthWarnCooldown || props.maxLength == null) return
  maxLengthWarnCooldown = true
  const limit = props.maxLength.toLocaleString('zh-CN')
  message.warning(
    props.maxLengthWarning ?? `剧本字数已达上限（${limit}字），无法继续输入`
  )
  window.setTimeout(() => {
    maxLengthWarnCooldown = false
  }, 1500)
}

function getEmittedHtml(q: import('quill').default): string {
  if (isQuillTextEmpty(q)) return ''
  return q.getSemanticHTML()
}

/** 将纯文本 @ 标签 / 结构化字段解析为带引用块的 HTML，便于 Quill 渲染为 embed */
function rebuildPromptRefHtml(html: string): string {
  if (!props.enablePromptAssetRefs && !props.enablePromptParamRefs) return html
  const plain = storyboardPromptHtmlToPlain(html)
  if (
    !plain.includes('@') &&
    !plainHasImageLabeledParamFields(plain) &&
    !plainHasVideoLabeledParamFields(plain)
  ) {
    return html
  }
  const rebuilt = storyboardPromptPlainToHtml(plain, props.promptAssets, props.promptParamGroups, {
    enableImageLabeledParams: props.enablePromptParamRefs,
    enableVideoLabeledParams: props.enablePromptParamRefs,
    enableAssetRefs: props.enablePromptAssetRefs
  })
  return rebuilt || html
}

/** 父组件 v-model 与编辑器刚 emit 的 HTML 相同时跳过 apply，避免 getSemanticHTML 往返破坏 Embed、误触发保护逻辑 */
let lastEmittedFromLockMode: string | null = null

function applyHtml(html: string) {
  if (!quill) return
  const caretToRestore = pendingCaretIndex ?? quill.getSelection(true)?.index ?? null
  syncingFromProp = true
  const content = rebuildPromptRefHtml(html || '')
  quill.clipboard.dangerouslyPasteHTML(content)
  nextTick(() => {
    syncingFromProp = false
    restoreCaretIndex(caretToRestore)
    if (props.lockCharacterSettingKeys && quill) {
      lastEmittedFromLockMode = getEmittedHtml(quill)
    }
  })
}

function restoreCaretIndex(index: number | null, focus = false) {
  if (!quill || index == null || index < 0) return
  const maxIdx = Math.max(0, quill.getLength() - 1)
  const pos = Math.min(index, maxIdx)
  pendingCaretIndex = pos
  quill.setSelection(pos, 0, 'silent')
  if (focus) quill.focus()
}

/** 在 v-model 回写 / hydrate 等异步链路结束后再次恢复光标 */
function scheduleCaretRestore(focus = false) {
  if (pendingCaretIndex == null) return
  const target = pendingCaretIndex
  nextTick(() => {
    nextTick(() => {
      restoreCaretIndex(target, focus)
    })
  })
}

/** 角色设定受保护 Embed：基本信息字段名 + 锁定小节标题 */
function protectedEmbedMultiset(delta: {
  ops: ReadonlyArray<{ insert?: unknown }>
}): Map<string, number> {
  const m = new Map<string, number>()
  for (const op of delta.ops) {
    const ins = op.insert
    if (ins == null || typeof ins !== 'object' || Array.isArray(ins)) continue
    if ('characterSettingKey' in ins) {
      const k = `k:${String((ins as { characterSettingKey: string }).characterSettingKey)}`
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    if ('characterSettingSection' in ins) {
      const k = `s:${String((ins as { characterSettingSection: string }).characterSettingSection)}`
      m.set(k, (m.get(k) ?? 0) + 1)
    }
  }
  return m
}

function protectedMultisetLost(before: Map<string, number>, after: Map<string, number>): boolean {
  for (const [key, c] of before) {
    if ((after.get(key) ?? 0) < c) return true
  }
  return false
}

/**
 * 仅当本次变更里出现「删除长度」时才比对受保护 Embed。
 * 否则在 Quill 2 下，纯插入也可能出现前后 getContents 与 oldDelta 序列化不一致，导致误判丢 Embed，
 * 从而每次输入都回滚并反复弹窗。
 */
function deltaHasPositiveDelete(
  delta: { ops?: ReadonlyArray<{ delete?: number }> } | null | undefined
): boolean {
  if (!delta?.ops) return false
  return delta.ops.some((op) => typeof op.delete === 'number' && op.delete > 0)
}

/** 从 HTML 提取受保护块指纹（避免 v-model 与 getSemanticHTML 仅差空白/属性顺序时反复 applyHtml 破坏 Embed） */
function protectedStructureFingerprint(html: string): string {
  if (!import.meta.client || !html?.trim()) return ''
  try {
    const doc = new DOMParser().parseFromString(`<div id="scp-fp">${html}</div>`, 'text/html')
    const root = doc.getElementById('scp-fp')
    if (!root) return ''
    const keys = [...root.querySelectorAll('.scp-char-setting-key')].map((e) =>
      (e.textContent ?? '').trim()
    )
    const secs = [...root.querySelectorAll('.scp-char-setting-section')].map((e) =>
      (e.textContent ?? '').trim()
    )
    const pack = (arr: string[], p: string) =>
      arr
        .filter(Boolean)
        .map((t) => `${p}:${t}`)
        .sort()
        .join('|')
    return `${pack(keys, 'k')}##${pack(secs, 's')}`
  } catch {
    return html
  }
}

onMounted(async () => {
  if (!import.meta.client || !hostRef.value) return
  const mountToken = mountGate.begin()

  try {
  const [{ default: Quill }, _css] = await Promise.all([
    import('quill'),
    import('quill/dist/quill.snow.css')
  ])

  if (
    !shouldProceedQuillMount({
      token: mountToken,
      gate: mountGate,
      container: hostRef.value
    })
  ) {
    return
  }

  /** 全局注册一次即可；仅 lockCharacterSettingKeys 时用剪贴板 matcher 转为原子 Embed */
  registerCharacterSettingProtectedBlots(Quill)
  if (props.enablePromptAssetRefs) {
    registerPromptAssetRefBlot(Quill)
  }
  if (props.enablePromptParamRefs) {
    registerPromptParamRefBlot(Quill)
  }
  QuillCtor = Quill

  const instance = createQuillSafely(
    (container) =>
      new Quill(container, {
        theme: 'snow',
        modules: { toolbar: false },
        placeholder: props.placeholder,
        readOnly: props.disabled
      }),
    hostRef.value
  )
  if (!instance || !mountGate.isCurrent(mountToken)) {
    QuillCtor = null
    if (mountGate.isCurrent(mountToken) && !instance) {
      console.error('[RichTextEditor] Quill mount failed: invalid container')
    }
    return
  }
  quill = instance

  // 粘贴 / dangerouslyPasteHTML：剥离外部站点的背景色、字色等内联样式，统一为深色底上的白字
  const Delta = Quill.import('delta') as typeof import('quill-delta').default
  const PASTE_TEXT_COLOR = '#ffffff'
  function stripExternalPasteAttrs(attrs?: Record<string, unknown>) {
    const next: Record<string, unknown> = { ...(attrs ?? {}) }
    delete next.background
    delete next['background-color']
    delete next.color
    next.color = PASTE_TEXT_COLOR
    return next
  }
  function normalizeClipboardDelta(delta: InstanceType<typeof Delta>) {
    const d = new Delta()
    for (const op of delta.ops) {
      const ins = op.insert
      if (ins !== undefined && ins !== null) {
        if (typeof ins === 'string') {
          d.insert(ins, stripExternalPasteAttrs(op.attributes))
        } else {
          d.insert(ins, op.attributes ? stripExternalPasteAttrs(op.attributes) : op.attributes)
        }
      } else if (op.retain !== undefined) {
        d.retain(
          op.retain as number,
          op.attributes ? stripExternalPasteAttrs(op.attributes) : op.attributes
        )
      } else if (op.delete !== undefined) {
        d.delete(op.delete as number)
      }
    }
    return d
  }
  /** 小说站等来源的 HTML 常带 selection / 主题背景，先 DOM 层剥离再交给 Quill */
  function sanitizePastedHtml(html: string): string {
    if (!html?.trim()) return html
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      doc.body.querySelectorAll<HTMLElement>('*').forEach((el) => {
        el.style.removeProperty('background')
        el.style.removeProperty('background-color')
        el.style.removeProperty('-webkit-text-fill-color')
        el.style.removeProperty('color')
        el.removeAttribute('bgcolor')
      })
      return doc.body.innerHTML
    } catch {
      return html
    }
  }
  const editorRoot = quill.root as HTMLElement
  editorRoot.addEventListener(
    'paste',
    (e) => {
      const html = e.clipboardData?.getData('text/html')
      if (!html?.trim()) return
      e.preventDefault()
      e.stopImmediatePropagation()
      const range = quill!.getSelection(true)
      if (!range) return
      const sanitized = sanitizePastedHtml(html)
      const text = e.clipboardData?.getData('text/plain') ?? ''
      const pastedDelta = quill!.clipboard.convert({ html: sanitized, text })
      const normalized = normalizeClipboardDelta(pastedDelta)
      quill!.updateContents(
        new Delta().retain(range.index).delete(range.length).concat(normalized),
        'user'
      )
      quill!.setSelection(range.index + normalized.length(), 'silent')
      quill!.scrollSelectionIntoView()
    },
    true
  )
  quill.clipboard.addMatcher(Node.ELEMENT_NODE, (node, delta) => {
    if (node instanceof HTMLElement && node.tagName === 'SPAN') {
      const DeltaCtor = Quill.import('delta') as typeof import('quill-delta').default
      if (props.enablePromptAssetRefs && node.classList.contains('scp-prompt-asset-ref')) {
        return new DeltaCtor().insert({ promptAssetRef: readPromptAssetRefFromNode(node) })
      }
      if (props.enablePromptParamRefs && node.classList.contains('scp-prompt-param-ref')) {
        return new DeltaCtor().insert({ promptParamRef: readPromptParamRefFromNode(node) })
      }
      if (props.lockCharacterSettingKeys) {
        if (node.classList.contains('scp-char-setting-section')) {
          return new DeltaCtor().insert({ characterSettingSection: node.textContent ?? '' })
        }
        if (node.classList.contains('scp-char-setting-key')) {
          return new DeltaCtor().insert({ characterSettingKey: node.textContent ?? '' })
        }
      }
    }
    return normalizeClipboardDelta(delta)
  })

  const SILENT = Quill.sources.SILENT

  /**
   * 受保护 Embed 回滚时 `setContents` 会整体替换文档，选区可能被映射到 Embed 内部或非法下标，
   * 表现为后续无法输入。将光标移出 Embed 并重新聚焦。
   */
  function restoreCaretAfterProtectedRollback(q: import('quill').default) {
    const len = q.getLength()
    const maxIdx = Math.max(0, len - 1)
    const clamp = (i: number) => Math.max(0, Math.min(i, maxIdx))

    let range = q.getSelection()
    if (!range || range.index < 0 || range.index >= len) {
      q.setSelection(clamp(len - 2), 0, SILENT)
      q.focus()
      return
    }

    let { index } = range
    const leafPair = q.getLeaf(index) as
      | [InstanceType<typeof import('parchment').LeafBlot>, number]
      | undefined
    if (!leafPair) {
      q.focus()
      return
    }
    const [leaf, offset] = leafPair
    const blotName = (leaf.constructor as { blotName?: string }).blotName
    if (blotName === 'characterSettingKey' || blotName === 'characterSettingSection') {
      const leafLen = typeof leaf.length === 'function' ? leaf.length() : 1
      const afterEmb = index - offset + leafLen
      q.setSelection(clamp(afterEmb), 0, SILENT)
    }
    q.focus()
  }

  let composing = false

  const markInputting = () => {
    if (!props.disabled) isInputting.value = true
  }
  const clearInputting = () => {
    if (!composing && isQuillTextEmpty(quill!)) isInputting.value = false
  }
  const onCompositionStart = () => {
    composing = true
    markInputting()
  }
  const onCompositionEnd = () => {
    composing = false
    if (!isQuillTextEmpty(quill!)) isInputting.value = false
    else clearInputting()
  }
  const onBlur = () => {
    composing = false
    isInputting.value = false
  }

  editorRoot.addEventListener('beforeinput', markInputting)
  editorRoot.addEventListener('compositionstart', onCompositionStart)
  editorRoot.addEventListener('compositionend', onCompositionEnd)
  editorRoot.addEventListener('blur', onBlur)
  cleanupEditorInputListeners = () => {
    editorRoot.removeEventListener('beforeinput', markInputting)
    editorRoot.removeEventListener('compositionstart', onCompositionStart)
    editorRoot.removeEventListener('compositionend', onCompositionEnd)
    editorRoot.removeEventListener('blur', onBlur)
  }

  if (props.enablePromptAssetRefs) {
    const onAssetRefClick = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null
      const el = target?.closest?.('.scp-prompt-asset-ref') as HTMLElement | null
      if (!el || !quill || !QuillCtor) return
      ev.preventDefault()
      ev.stopPropagation()
      const blot = QuillCtor.find(el) as { length?: () => number } | null
      if (!blot) return
      activeAssetBlotIndex = quill.getIndex(blot as never)
      pickerSelectedAssetId.value = el.dataset.assetId
      pickerAnchorRect.value = el.getBoundingClientRect()
      pickerOpen.value = true
    }
    editorRoot.addEventListener('click', onAssetRefClick)
    cleanupAssetRefClick = () => editorRoot.removeEventListener('click', onAssetRefClick)
  }

  if (props.enablePromptParamRefs) {
    const onParamRefClick = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null
      const el = target?.closest?.('.scp-prompt-param-ref') as HTMLElement | null
      if (!el || !quill || !QuillCtor) return
      ev.preventDefault()
      ev.stopPropagation()
      const blot = QuillCtor.find(el) as { length?: () => number } | null
      if (!blot) return
      const ref = readPromptParamRefFromNode(el)
      const group = findParamGroup(props.promptParamGroups, ref.paramType)
      if (!group?.options.length) return
      activeParamBlotIndex = quill.getIndex(blot as never)
      activeParamType = ref.paramType
      paramPickerOptions.value = group.options.filter((o) => o.key !== 'none')
      paramPickerSelectedKey.value = ref.key
      paramPickerAnchorRect.value = el.getBoundingClientRect()
      paramPickerOpen.value = true
    }
    editorRoot.addEventListener('click', onParamRefClick)
    const prevCleanup = cleanupAssetRefClick
    cleanupAssetRefClick = () => {
      prevCleanup?.()
      editorRoot.removeEventListener('click', onParamRefClick)
    }
  }

  quill.on('text-change', (change, oldDelta, source) => {
    if (!quill) return
    if (source === 'silent') return
    if (syncingFromProp) return

    if (props.lockCharacterSettingKeys && source === 'user' && deltaHasPositiveDelete(change)) {
      const mb = protectedEmbedMultiset(oldDelta)
      const ma = protectedEmbedMultiset(quill.getContents())
      if (mb.size > 0 && protectedMultisetLost(mb, ma)) {
        quill.setContents(oldDelta, SILENT)
        skipWatchUpdate = true
        const rolled = getEmittedHtml(quill)
        lastEmittedFromLockMode = rolled
        emit('update:modelValue', rolled)
        nextTick(() => {
          skipWatchUpdate = false
          restoreCaretAfterProtectedRollback(quill!)
          message.warning('小节标题与基本信息字段名不可删除或修改')
        })
        return
      }
    }

    if (props.maxLength != null && props.maxLength > 0) {
      const len = getPlainLen(quill)
      if (len > props.maxLength) {
        quill.setContents(oldDelta, 'silent')
        warnMaxLengthReached()
        return
      }
    }

    const html = getEmittedHtml(quill)
    if (!isQuillTextEmpty(quill)) {
      isInputting.value = false
    }
    if (props.lockCharacterSettingKeys) {
      lastEmittedFromLockMode = html
    }
    skipWatchUpdate = true
    emit('update:modelValue', html)
    nextTick(() => {
      skipWatchUpdate = false
    })
  })

  if (!mountGate.isCurrent(mountToken) || !quill) {
    quill = null
    QuillCtor = null
    return
  }

  applyHtml(props.modelValue || '')

  if (!mountGate.isCurrent(mountToken)) {
    quill = null
    QuillCtor = null
    return
  }
  isReady.value = true
  } catch (err) {
    cleanupEditorInputListeners?.()
    cleanupEditorInputListeners = null
    cleanupAssetRefClick?.()
    cleanupAssetRefClick = null
    quill = null
    QuillCtor = null
    isReady.value = false
    /** 已卸载：吞掉竞态错误，禁止冒泡成 Nuxt 整页 500 */
    if (!mountGate.isCurrent(mountToken)) return
    const msg = err instanceof Error ? err.message : String(err)
    if (/invalid quill container/i.test(msg)) {
      console.error('[RichTextEditor] Quill mount failed:', msg)
      return
    }
    throw err
  }
})

watch(
  () => props.modelValue,
  (val) => {
    if (!quill || !isReady.value || skipWatchUpdate) return
    const next = val || ''
    if (props.lockCharacterSettingKeys && next === lastEmittedFromLockMode) {
      return
    }
    if (lastEmittedPromptHtml != null && next === lastEmittedPromptHtml) {
      lastEmittedPromptHtml = null
      scheduleCaretRestore(true)
      return
    }
    const cur = getEmittedHtml(quill)
    if (cur === next) {
      scheduleCaretRestore(true)
      return
    }
    if (
      props.lockCharacterSettingKeys &&
      protectedStructureFingerprint(next) === protectedStructureFingerprint(cur) &&
      htmlToPlainText(next) === htmlToPlainText(cur)
    ) {
      lastEmittedFromLockMode = next
      scheduleCaretRestore(true)
      return
    }
    if (props.enablePromptAssetRefs || props.enablePromptParamRefs) {
      const curPlain = storyboardPromptHtmlToPlain(cur)
      const nextPlain = storyboardPromptHtmlToPlain(next)
      if (curPlain === nextPlain) {
        scheduleCaretRestore(true)
        return
      }
    }
    applyHtml(next)
  }
)

watch(
  () => props.disabled,
  (d) => {
    quill?.enable(!d)
  }
)

watch(
  [() => props.promptAssets, () => props.promptParamGroups],
  () => {
    if (!quill || !isReady.value || skipWatchUpdate) return
    if (!props.enablePromptAssetRefs && !props.enablePromptParamRefs) return
    const cur = getEmittedHtml(quill)
    const plain = storyboardPromptHtmlToPlain(cur)
    if (
      !plain.includes('@') &&
      !plainHasImageLabeledParamFields(plain) &&
      !plainHasVideoLabeledParamFields(plain)
    ) {
      return
    }
    const next = rebuildPromptRefHtml(cur)
    if (next && next !== cur) {
      const curPlain = storyboardPromptHtmlToPlain(cur)
      const nextPlain = storyboardPromptHtmlToPlain(next)
      if (curPlain !== nextPlain) {
        applyHtml(next)
      }
    }
  },
  { deep: true }
)

function closeAssetPicker() {
  pickerOpen.value = false
  activeAssetBlotIndex = null
}

function closeParamPicker() {
  paramPickerOpen.value = false
  activeParamBlotIndex = null
  activeParamType = null
}

function emitHtmlFromEditor() {
  if (!quill) return
  const html = getEmittedHtml(quill)
  lastEmittedPromptHtml = html
  skipWatchUpdate = true
  emit('update:modelValue', html)
  nextTick(() => {
    skipWatchUpdate = false
    scheduleCaretRestore(true)
  })
}

/** 当前或最近一次光标位置（失焦后 Quill 仍保留 last range，需 focus=true） */
function getCaretInsertIndex(): number {
  if (!quill) return 0
  const range = quill.getSelection(true)
  const maxIdx = Math.max(0, quill.getLength() - 1)
  if (range && range.index >= 0) {
    return Math.min(range.index, maxIdx)
  }
  return maxIdx
}

/** 将光标移动到指定下标，并可选重新聚焦编辑器 */
function placeCaretAt(index: number, focus = true) {
  if (!quill) return
  const maxIdx = Math.max(0, quill.getLength() - 1)
  const pos = Math.min(Math.max(0, index), maxIdx)
  pendingCaretIndex = pos
  quill.setSelection(pos, 0, 'silent')
  if (focus) quill.focus()
}

/**
 * 在光标处插入 @ 引用块（图片 / 构图等参数）
 * 非空文档且光标前非空白时在块前补空格，块后补空格并将光标置于块后
 */
function insertPromptEmbedAtCaret(
  embedKey: 'promptAssetRef' | 'promptParamRef',
  value: PromptAssetRefValue | PromptParamRefValue,
  source: 'user' | 'silent' = 'user'
): number {
  if (!quill) return 0
  const hadUserCaret = quill.getSelection(true) != null
  let index = getCaretInsertIndex()
  if (!isQuillTextEmpty(quill)) {
    const prevChar = index > 0 ? quill.getText(index - 1, 1) : ''
    if (index > 0 && prevChar && !/\s/.test(prevChar)) {
      quill.insertText(index, ' ', source)
      index += 1
    }
  }
  quill.insertEmbed(index, embedKey, value, source)
  quill.insertText(index + 1, ' ', source)
  placeCaretAt(index + 2, hadUserCaret || source === 'user')
  return index
}

function findParamEmbedIndex(paramType: PromptParamType): number | null {
  if (!quill) return null
  let index = 0
  for (const op of quill.getContents().ops) {
    const ins = op.insert
    if (ins != null && typeof ins === 'object' && 'promptParamRef' in ins) {
      const v = ins.promptParamRef as PromptParamRefValue
      if (v.paramType === paramType) return index
      index += 1
      continue
    }
    if (typeof ins === 'string') index += ins.length
    else index += 1
  }
  return null
}

/** 在编辑器纯文本中定位 @标签 对应的 Quill 区间（用于将纯文本占位转为 embed） */
function findPlainTagQuillRange(tag: string): { index: number; length: number } | null {
  if (!quill || !tag) return null
  const needles = [tag, tag.startsWith('@') ? tag : `@${tag}`]
  let plain = ''
  const indexMap: number[] = []
  let index = 0

  for (const op of quill.getContents().ops) {
    const ins = op.insert
    if (typeof ins === 'string') {
      for (let i = 0; i < ins.length; i++) {
        indexMap[plain.length] = index + i
        plain += ins[i]
      }
      index += ins.length
      continue
    }
    if (ins != null && typeof ins === 'object') {
      if ('promptParamRef' in ins) {
        const v = ins.promptParamRef as PromptParamRefValue
        const label = v.label || ''
        for (let i = 0; i < label.length; i++) {
          indexMap[plain.length] = index
          plain += label[i]
        }
        index += 1
        continue
      }
      if ('promptAssetRef' in ins) {
        const v = ins.promptAssetRef as { imageIndex?: number; name?: string }
        const label = v.imageIndex && v.name ? formatAssetApiPlaceholder(v.imageIndex, v.name) : ''
        for (let i = 0; i < label.length; i++) {
          indexMap[plain.length] = index
          plain += label[i]
        }
        index += 1
        continue
      }
      index += 1
    }
  }

  for (const needle of needles) {
    const pos = plain.indexOf(needle)
    if (pos >= 0 && indexMap[pos] != null) {
      return { index: indexMap[pos], length: needle.length }
    }
  }
  return null
}

function getParamEmbedValue(paramType: PromptParamType): PromptParamRefValue | null {
  const idx = findParamEmbedIndex(paramType)
  if (idx == null || !quill) return null
  const leaf = quill.getLeaf(idx) as
    | [InstanceType<typeof import('parchment').LeafBlot>, number]
    | undefined
  if (!leaf?.[0]) return null
  const blotName = (leaf[0].constructor as { blotName?: string }).blotName
  if (blotName !== 'promptParamRef') return null
  const dom = leaf[0].domNode as HTMLElement | undefined
  return dom ? readPromptParamRefFromNode(dom) : null
}

/** 同步某一类参数标签（右侧下拉选中 / 取消时调用） */
function syncPromptParamRef(
  paramType: PromptParamType,
  selection: { key: string; value: string } | null | undefined
) {
  if (!quill || !props.enablePromptParamRefs) return
  const nextRef = selectionToParamRef(paramType, selection)
  const existing = getParamEmbedValue(paramType)
  if (paramRefsEqual(existing, nextRef)) return

  syncingFromProp = true
  const plainBefore = storyboardPromptHtmlToPlain(getEmittedHtml(quill))
  const SILENT = 'silent' as const
  const existingIdx = findParamEmbedIndex(paramType)
  const explicitNone = selection?.key === 'none'

  if (!nextRef) {
    if (explicitNone && existingIdx != null) {
      quill.deleteText(existingIdx, 1, SILENT)
    }
  } else if (existingIdx != null) {
    quill.deleteText(existingIdx, 1, SILENT)
    quill.insertEmbed(existingIdx, 'promptParamRef', nextRef, SILENT)
  } else {
    const plainRange = findPlainTagQuillRange(nextRef.label)
    if (plainRange) {
      quill.deleteText(plainRange.index, plainRange.length, SILENT)
      quill.insertEmbed(plainRange.index, 'promptParamRef', nextRef, SILENT)
    } else {
      insertPromptEmbedAtCaret('promptParamRef', nextRef, SILENT)
    }
  }

  syncingFromProp = false
  const plainAfter = storyboardPromptHtmlToPlain(getEmittedHtml(quill))
  if (plainBefore !== plainAfter) {
    emitHtmlFromEditor()
  }
}

function onPickerSelectAsset(item: PromptAssetItem) {
  if (!quill || activeAssetBlotIndex == null) {
    closeAssetPicker()
    return
  }
  const v = promptAssetItemToRefValue(item)
  quill.deleteText(activeAssetBlotIndex, 1, 'user')
  quill.insertEmbed(activeAssetBlotIndex, 'promptAssetRef', v, 'user')
  emitHtmlFromEditor()
  closeAssetPicker()
  placeCaretAt(activeAssetBlotIndex + 2, true)
}

function onParamPickerSelect(option: PromptParamOption) {
  if (!quill || activeParamBlotIndex == null || !activeParamType) {
    closeParamPicker()
    return
  }
  const nextRef = selectionToParamRef(activeParamType, option)
  if (!nextRef) {
    closeParamPicker()
    return
  }
  quill.deleteText(activeParamBlotIndex, 1, 'user')
  quill.insertEmbed(activeParamBlotIndex, 'promptParamRef', nextRef, 'user')
  emitHtmlFromEditor()
  emit('promptParamChange', {
    paramType: activeParamType,
    selection: { key: option.key, value: option.value }
  })
  closeParamPicker()
  placeCaretAt(activeParamBlotIndex + 2, true)
}

function findAssetEmbedIndex(assetId: string): number | null {
  if (!quill || !assetId) return null
  let index = 0
  for (const op of quill.getContents().ops) {
    const ins = op.insert
    if (ins != null && typeof ins === 'object' && 'promptAssetRef' in ins) {
      const v = ins.promptAssetRef as { assetId?: string }
      if (v.assetId === assetId) return index
      index += 1
      continue
    }
    if (typeof ins === 'string') index += ins.length
    else index += 1
  }
  return null
}

function findAssetEmbedIndexByMatch(hint: {
  assetId?: string
  imageIndex?: number
  name?: string
}): number | null {
  if (!quill) return null
  if (hint.assetId) {
    const byId = findAssetEmbedIndex(hint.assetId)
    if (byId != null) return byId
  }
  const hintName = hint.name ? hint.name.replace(/^@/, '').trim() : ''
  let index = 0
  for (const op of quill.getContents().ops) {
    const ins = op.insert
    if (ins != null && typeof ins === 'object' && 'promptAssetRef' in ins) {
      const v = ins.promptAssetRef as { imageIndex?: number; name?: string }
      if (hint.imageIndex != null && v.imageIndex === hint.imageIndex) return index
      const embedName = String(v.name || '').replace(/^@/, '').trim()
      if (hintName && embedName === hintName) return index
      index += 1
      continue
    }
    if (typeof ins === 'string') index += ins.length
    else index += 1
  }
  return null
}

function upsertPromptAssetRef(item: PromptAssetItem) {
  if (!quill || !props.enablePromptAssetRefs) return
  const idx = findAssetEmbedIndexByMatch({
    assetId: item.assetId,
    imageIndex: item.imageIndex,
    name: item.name
  })
  syncingFromProp = true
  const refValue = promptAssetItemToRefValue(item)
  if (idx != null) {
    quill.deleteText(idx, 1, 'user')
    quill.insertEmbed(idx, 'promptAssetRef', refValue, 'user')
    const hadUserCaret = quill.getSelection(true) != null
    placeCaretAt(idx + 2, hadUserCaret)
  } else {
    insertPromptEmbedAtCaret('promptAssetRef', refValue, 'user')
  }
  syncingFromProp = false
  emitHtmlFromEditor()
}

function insertPromptAssetRef(item: PromptAssetItem) {
  upsertPromptAssetRef(item)
}

function removePromptAssetRef(assetId: string) {
  removePromptAssetRefByMatch({ assetId })
}

function removePromptAssetRefByMatch(hint: {
  assetId?: string
  imageIndex?: number
  name?: string
}) {
  if (!quill || !props.enablePromptAssetRefs) return
  const idx = findAssetEmbedIndexByMatch(hint)
  if (idx == null) return
  syncingFromProp = true
  quill.deleteText(idx, 1, 'user')
  syncingFromProp = false
  emitHtmlFromEditor()
}

function togglePromptAssetRef(item: PromptAssetItem, selected: boolean) {
  if (selected) upsertPromptAssetRef(item)
  else removePromptAssetRefByMatch(item)
}

/** 为尚未写入描述框的已导入资产追加引用块；已有同名/同序号块则升级 url */
function syncMissingPromptAssetRefs(overrideAssets?: PromptAssetItem[]) {
  const assets = overrideAssets ?? props.promptAssets
  if (!quill || !props.enablePromptAssetRefs || !assets.length) return
  const html = getEmittedHtml(quill)
  const existing = extractReferencedAssetIdsFromHtml(html)
  const existingIndexes = extractReferencedImageIndexesFromHtml(html)

  for (const item of assets) {
    if (
      existing.has(item.assetId) ||
      existingIndexes.has(item.imageIndex) ||
      findAssetEmbedIndexByMatch({ imageIndex: item.imageIndex, name: item.name }) != null
    ) {
      if (!isEmptyPromptAssetUrl(item.url)) {
        upsertPromptAssetRef(item)
      }
      continue
    }
  }

  const missing = assets.filter(
    (a) =>
      !existing.has(a.assetId) &&
      !existingIndexes.has(a.imageIndex) &&
      findAssetEmbedIndexByMatch({ imageIndex: a.imageIndex, name: a.name }) == null
  )
  if (!missing.length) return

  syncingFromProp = true
  for (const item of missing) {
    insertPromptEmbedAtCaret('promptAssetRef', promptAssetItemToRefValue(item), 'silent')
  }
  syncingFromProp = false
  const nextHtml = getEmittedHtml(quill)
  lastEmittedPromptHtml = nextHtml
  skipWatchUpdate = true
  emit('update:modelValue', nextHtml)
  nextTick(() => {
    skipWatchUpdate = false
    scheduleCaretRestore(true)
  })
}

function getPlainPrompt(): string {
  if (!quill) return storyboardPromptHtmlToPlain(props.modelValue || '')
  return storyboardPromptHtmlToPlain(getEmittedHtml(quill))
}

onBeforeUnmount(() => {
  mountGate.dispose()
  isReady.value = false
  cleanupEditorInputListeners?.()
  cleanupEditorInputListeners = null
  cleanupAssetRefClick?.()
  cleanupAssetRefClick = null
  quill = null
  QuillCtor = null
})

function hydratePromptRefEmbeds() {
  if (!quill) return
  const cur = getEmittedHtml(quill)
  const next = rebuildPromptRefHtml(cur)
  if (!next || next === cur) return
  const curPlain = storyboardPromptHtmlToPlain(cur)
  const nextPlain = storyboardPromptHtmlToPlain(next)
  applyHtml(next)
  if (curPlain !== nextPlain) {
    emitHtmlFromEditor()
  } else {
    scheduleCaretRestore(true)
  }
}

defineExpose({
  focus: () => quill?.focus(),
  getHtml: () => (quill ? getEmittedHtml(quill) : props.modelValue || ''),
  getPlainPrompt,
  insertPromptAssetRef,
  upsertPromptAssetRef,
  removePromptAssetRef,
  removePromptAssetRefByMatch,
  togglePromptAssetRef,
  syncMissingPromptAssetRefs,
  syncPromptParamRef,
  hydratePromptRefEmbeds
})
</script>

<style scoped lang="scss">
.rich-text-editor {
  width: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.rich-text-editor__host {
  width: 100%;
  min-width: 0;
}

/* 对齐创作页原 ant-input-textarea：默认无边线感，移入/聚焦时出现青色系描边 */
.rich-text-editor__host :deep(.ql-container.ql-snow) {
  border: 1px solid transparent;
  border-radius: var(--radius-md, 8px);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  font-family: inherit;
}

.rich-text-editor__host :deep(.ql-container.ql-snow:hover) {
  border-color: rgba(74, 231, 253, 0.45);
}

/* 强制正文白字、透明底，避免外部站点粘贴的背景色/字色在深色编辑器中不可见 */
.rich-text-editor__host :deep(.ql-editor),
.rich-text-editor__host :deep(.ql-editor *) {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
}

.rich-text-editor__host :deep(.ql-editor *:not(.scp-prompt-asset-ref):not(.scp-prompt-param-ref)) {
  background: transparent !important;
  background-color: transparent !important;
}

.rich-text-editor--lock-char-keys
  .rich-text-editor__host
  :deep(.ql-editor .scp-char-setting-section) {
  color: #4ae7fd !important;
}

.rich-text-editor__host :deep(.ql-editor) {
  min-height: var(--rte-min-height, 120px);
  max-height: var(--rte-max-height, none);
  overflow-y: auto;
  padding: 10px 12px;
  line-height: 1.6;
  font-size: inherit;
}

.rich-text-editor__count {
  position: absolute;
  right: 12px;
  bottom: 10px;
  z-index: 2;
  pointer-events: none;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(12, 16, 24, 0.72);
}

.rich-text-editor__count--limit {
  color: #ff7875;
}

.rich-text-editor:has(.rich-text-editor__count) .rich-text-editor__host :deep(.ql-editor) {
  padding-bottom: 28px;
}

.rich-text-editor__host :deep(.ql-editor.ql-blank::before) {
  color: rgba(142, 151, 165, 0.45);
  font-style: normal;
}

.rich-text-editor__host :deep(.ql-container:focus-within .ql-editor.ql-blank::before),
.rich-text-editor.is-inputting :deep(.ql-editor.ql-blank::before) {
  opacity: 0;
}

/* 分镜图 @图片 引用块：按资产类型区分背景色 */
.rich-text-editor__host :deep(.ql-editor .scp-prompt-asset-ref) {
  display: inline;
  margin: 0 2px;
  padding: 2px 8px;
  border: none;
  border-radius: 4px;
  vertical-align: baseline;
  cursor: pointer;
  user-select: none;
  line-height: 1.5;
  white-space: nowrap;
  background: rgba(14, 89, 250, 0.22);
}

.rich-text-editor__host :deep(.ql-editor .scp-prompt-asset-ref--scene) {
  background: rgba(14, 89, 250, 0.22) !important;
}

.rich-text-editor__host :deep(.ql-editor .scp-prompt-asset-ref--character) {
  background: rgba(168, 85, 247, 0.22) !important;
}

.rich-text-editor__host :deep(.ql-editor .scp-prompt-asset-ref--prop) {
  background: rgba(245, 158, 11, 0.22) !important;
}

.rich-text-editor__host :deep(.ql-editor .scp-prompt-asset-ref--audio) {
  --create-ref-audio-bg: var(--accent-100, rgba(74, 231, 253, 0.1));
  --create-ref-audio-border: var(--accent-400, rgba(74, 231, 253, 0.42));
  --create-ref-audio-text: var(--accent-500, #4ae7fd);
  background: var(--create-ref-audio-bg);
  border: 1px solid var(--create-ref-audio-border);
  color: var(--create-ref-audio-text);
}

.rich-text-editor__host :deep(.ql-editor .scp-prompt-asset-ref--other) {
  background: rgba(74, 231, 253, 0.16) !important;
}

.rich-text-editor__host :deep(.ql-editor .scp-prompt-asset-ref__thumb) {
  display: none !important;
}

.rich-text-editor__host :deep(.ql-editor .scp-prompt-asset-ref__label) {
  display: inline;
  font-size: 12px;
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
}

/* 分镜图 @构图 / @景别 等参数引用块：按参数类型区分背景色 */
.rich-text-editor__host :deep(.ql-editor .scp-prompt-param-ref) {
  display: inline;
  margin: 0 2px;
  padding: 2px 8px;
  border: none;
  border-radius: 4px;
  vertical-align: baseline;
  cursor: pointer;
  user-select: none;
  line-height: 1.5;
  white-space: nowrap;
  background: rgba(59, 130, 246, 0.24);
}

.rich-text-editor__host :deep(.ql-editor .scp-prompt-param-ref--composition) {
  background: rgba(59, 130, 246, 0.24) !important;
}

.rich-text-editor__host :deep(.ql-editor .scp-prompt-param-ref--shot_size) {
  background: rgba(139, 92, 246, 0.24) !important;
}

.rich-text-editor__host :deep(.ql-editor .scp-prompt-param-ref--camera_angle) {
  background: rgba(34, 197, 94, 0.22) !important;
}

.rich-text-editor__host :deep(.ql-editor .scp-prompt-param-ref--focal_length) {
  background: rgba(249, 115, 22, 0.22) !important;
}

.rich-text-editor__host :deep(.ql-editor .scp-prompt-param-ref--color_tone) {
  background: rgba(236, 72, 153, 0.22) !important;
}

.rich-text-editor__host :deep(.ql-editor .scp-prompt-param-ref--lighting) {
  background: rgba(234, 179, 8, 0.22) !important;
}

.rich-text-editor__host :deep(.ql-editor .scp-prompt-param-ref--exposure_blur) {
  background: rgba(20, 184, 166, 0.22) !important;
}

.rich-text-editor__host :deep(.ql-editor .scp-prompt-param-ref--camera_movement) {
  background: rgba(6, 182, 212, 0.22) !important;
}

.rich-text-editor__host :deep(.ql-editor .scp-prompt-param-ref--shooting_technique) {
  background: rgba(167, 139, 250, 0.24) !important;
}

.rich-text-editor__host :deep(.ql-editor .scp-prompt-param-ref__label) {
  display: inline;
  font-size: 12px;
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
}
</style>
