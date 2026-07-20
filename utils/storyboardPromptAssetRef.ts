/** 分镜图描述框内 @图片N[name] 资产引用 */

import {
  collectImageLabeledParamRefRanges,
  collectVideoLabeledParamRefRanges,
  findParamOptionByTag,
  plainHasImageLabeledParamFields,
  plainHasVideoLabeledParamFields,
  promptParamRefSpanHtml,
  readPromptParamRefFromNode,
  type ParamRefTextRange,
  type PromptParamGroup,
  type PromptParamRefValue
} from '~/utils/storyboardPromptParamRef'
import { looksLikeMarkdown, markdownToStoryScriptEditorHtml } from '~/utils/htmlPlain'

export type PromptAssetType = 'scene' | 'character' | 'prop' | 'other'

export interface PromptAssetItem {
  assetId: string
  assetType: PromptAssetType
  /** API 占位 name（不含 @） */
  name: string
  /** @图片N 中的 N */
  imageIndex: number
  url?: string
  /** 展示用，如 @场景1 */
  label: string
}

export interface PromptAssetRefValue {
  assetId: string
  assetType: PromptAssetType
  name: string
  imageIndex: number
  url?: string
  label: string
}

const API_PLACEHOLDER_RE = /@图片(\d+)\[([^\]]+)\]/g
const LEGACY_TAG_RE = /@([^\s@]+)/g

const TYPE_LABEL: Record<PromptAssetType, string> = {
  scene: '场景',
  character: '角色',
  prop: '道具',
  other: '其他'
}

function stripAt(s: string): string {
  return s.startsWith('@') ? s.slice(1) : s
}

export function isEmptyPromptAssetUrl(url?: string): boolean {
  return !String(url || '').trim()
}

export function promptAssetNamesMatch(
  a: { name?: string; label?: string },
  b: { name?: string; label?: string }
): boolean {
  const na = stripAt(String(a.name || a.label || '').trim())
  const nb = stripAt(String(b.name || b.label || '').trim())
  return !!na && !!nb && na === nb
}

/** 用本地真实图片补全解析失败（无 url）的 resolved 资产，保留原 @图片N 序号 */
export function patchEmptyResolvedPromptAssets(
  resolved: PromptAssetItem[],
  local: PromptAssetItem[]
): PromptAssetItem[] {
  if (!resolved.length || !local.length) return resolved
  return resolved.map((item) => {
    if (!isEmptyPromptAssetUrl(item.url)) return item
    const match = local.find((l) => promptAssetNamesMatch(item, l) && !isEmptyPromptAssetUrl(l.url))
    if (!match) return item
    return {
      ...item,
      assetId: match.assetId,
      assetType: match.assetType,
      url: match.url,
      label: item.label || match.label
    }
  })
}

function assetDisplayName(img: { title?: string; name?: string }, type: PromptAssetType, index: number): string {
  const raw = String(img?.title ?? img?.name ?? '').trim()
  if (raw) return stripAt(raw)
  return `${TYPE_LABEL[type]}${index + 1}`
}

function assetDisplayLabel(img: { title?: string; name?: string }, type: PromptAssetType, index: number): string {
  const name = assetDisplayName(img, type, index)
  return `@${name}`
}

/** 解析纯文本中的 @图片N[name] 占位（按 N 升序） */
export function parseApiImagePlaceholders(plain: string): Array<{ imageIndex: number; name: string }> {
  const list: Array<{ imageIndex: number; name: string }> = []
  const re = /@图片(\d+)\[([^\]]+)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(plain)) !== null) {
    list.push({ imageIndex: Number(m[1]), name: m[2] })
  }
  return list.sort((a, b) => a.imageIndex - b.imageIndex)
}

/** 将 resolve 接口结果映射为可点击资产项 */
export function buildPromptAssetsFromResolve(
  plain: string,
  data: { referenceImageIds?: number[]; referenceImageUrls?: string[]; unresolvedNames?: string[] }
): PromptAssetItem[] {
  const placeholders = parseApiImagePlaceholders(plain)
  const ids = data.referenceImageIds || []
  const urls = data.referenceImageUrls || []
  return dedupePromptAssets(
    placeholders.map((ph, i) => ({
      assetId: String(ids[i] ?? `resolved-${ph.imageIndex}-${ph.name}`),
      assetType: 'other' as PromptAssetType,
      name: ph.name,
      imageIndex: ph.imageIndex,
      url: urls[i] || '',
      label: `@${ph.name}`
    }))
  )
}

/** 按 assetId、name、imageIndex 去重（保留先出现的项） */
export function dedupePromptAssets(assets: PromptAssetItem[]): PromptAssetItem[] {
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  const seenIndexes = new Set<number>()
  const result: PromptAssetItem[] = []
  for (const item of assets) {
    const id = String(item.assetId || '').trim()
    const name = stripAt(String(item.name || item.label || '').trim())
    const idx = item.imageIndex
    if (id && seenIds.has(id)) continue
    if (name && seenNames.has(name)) continue
    if (idx > 0 && seenIndexes.has(idx)) continue
    if (id) seenIds.add(id)
    if (name) seenNames.add(name)
    if (idx > 0) seenIndexes.add(idx)
    result.push(item)
  }
  return result
}

/** 合并接口解析资产与本地导入资产（按 assetId / name 去重，本地序号冲突时顺延） */
export function mergePromptAssets(
  resolved: PromptAssetItem[],
  local: PromptAssetItem[]
): PromptAssetItem[] {
  const merged = resolved.map((a) => ({ ...a }))
  const byId = new Set(merged.map((a) => a.assetId))
  const byName = new Map(merged.map((a) => [stripAt(a.name), a]))
  const usedIndexes = new Set(merged.map((a) => a.imageIndex))
  let nextIndex = merged.reduce((m, a) => Math.max(m, a.imageIndex), 0) + 1

  for (const item of local) {
    const localName = stripAt(item.name)
    const existingByName = localName ? byName.get(localName) : undefined

    if (
      existingByName &&
      isEmptyPromptAssetUrl(existingByName.url) &&
      !isEmptyPromptAssetUrl(item.url)
    ) {
      const idx = merged.findIndex((a) => a.assetId === existingByName.assetId)
      if (idx >= 0) {
        const prevId = merged[idx].assetId
        merged[idx] = {
          ...item,
          imageIndex: existingByName.imageIndex,
          name: existingByName.name,
          label: existingByName.label || item.label
        }
        byId.delete(prevId)
        byId.add(merged[idx].assetId)
      }
      continue
    }

    if (byId.has(item.assetId)) continue
    if (localName && byName.has(localName)) continue
    let next = item
    if (usedIndexes.has(item.imageIndex)) {
      next = { ...item, imageIndex: nextIndex++ }
    } else {
      nextIndex = Math.max(nextIndex, item.imageIndex + 1)
    }
    merged.push(next)
    byId.add(next.assetId)
    if (localName) byName.set(localName, next)
    usedIndexes.add(next.imageIndex)
  }
  return dedupePromptAssets(merged)
}

/** 将四类导入列表合并为带全局图片序号的资产表 */
export function collectStoryboardPromptAssets(
  sceneImages: any[],
  characterImages: any[],
  propImages: any[],
  otherImages: any[],
  startImageIndex = 1
): PromptAssetItem[] {
  const list: PromptAssetItem[] = []
  let imageIndex = startImageIndex

  const pushList = (images: any[], assetType: PromptAssetType) => {
    images.forEach((img, i) => {
      const name = assetDisplayName(img, assetType, i)
      list.push({
        assetId: String(img?.id ?? `${assetType}-${i}-${name}`),
        assetType,
        name,
        imageIndex: imageIndex++,
        url: img?.url || img?.thumbnail || '',
        label: assetDisplayLabel(img, assetType, i)
      })
    })
  }

  pushList(sceneImages, 'scene')
  pushList(characterImages, 'character')
  pushList(propImages, 'prop')
  pushList(otherImages, 'other')
  return list
}

export function formatAssetApiPlaceholder(imageIndex: number, name: string): string {
  return `@图片${imageIndex}[${name}]`
}

/** 资产库内记录（aid_role_prop_scene_form_image）使用数字 ID */
export function isLibraryPromptAssetId(assetId: string | number | undefined | null): boolean {
  const id = String(assetId ?? '').trim()
  return /^\d+$/.test(id) && Number(id) > 0
}

/** 按占位序号/名称查找带有效 URL 的资产（优先 imageIndex，再按 name 兜底） */
export function findPromptAssetWithUrl(
  assets: PromptAssetItem[],
  hint: { imageIndex?: number; name?: string }
): PromptAssetItem | undefined {
  const primary = findPromptAsset(assets, hint)
  if (primary && !isEmptyPromptAssetUrl(primary.url)) return primary

  if (hint.imageIndex != null && hint.imageIndex > 0) {
    const byIdx = assets.find(
      (a) => a.imageIndex === hint.imageIndex && !isEmptyPromptAssetUrl(a.url)
    )
    if (byIdx) return byIdx
  }

  const name = hint.name ? stripAt(hint.name) : ''
  if (name) {
    const byName = assets.find(
      (a) =>
        !isEmptyPromptAssetUrl(a.url) &&
        (a.name === name || stripAt(a.label) === name)
    )
    if (byName) return byName
  }

  return undefined
}

/** 提示词中无法匹配到有效 URL 的 @图片N[name] 占位 */
export function listUnresolvedPromptImagePlaceholders(
  plain: string,
  assets: PromptAssetItem[]
): Array<{ imageIndex: number; name: string }> {
  return parseApiImagePlaceholders(plain).filter(
    (ph) => !findPromptAssetWithUrl(assets, { imageIndex: ph.imageIndex, name: ph.name })
  )
}

/**
 * 多参出片：从提示词占位 + 本地/解析资产构建 referenceOverrides。
 * key 必须为 prompt 内 @图片N[name] 的 name；有 URL 时一律传入（含库内资产，后端优先采用 overrides）。
 */
export function buildStoryboardVideoReferenceOverrides(
  plain: string,
  assets: PromptAssetItem[]
): Record<string, string> {
  const overrides: Record<string, string> = {}
  for (const ph of parseApiImagePlaceholders(plain)) {
    const asset = findPromptAssetWithUrl(assets, {
      imageIndex: ph.imageIndex,
      name: ph.name
    })
    const url = String(asset?.url ?? '').trim()
    if (!url) continue
    overrides[ph.name] = url
  }
  return overrides
}

export function promptAssetRefToPlaceholder(v: PromptAssetRefValue): string {
  return formatAssetApiPlaceholder(v.imageIndex, v.name)
}

export function promptAssetItemToRefValue(item: PromptAssetItem): PromptAssetRefValue {
  return {
    assetId: item.assetId,
    assetType: item.assetType,
    name: item.name,
    imageIndex: item.imageIndex,
    url: item.url,
    label: item.label
  }
}

/** 在资产表中查找（按 id、name、label） */
export function findPromptAsset(
  assets: PromptAssetItem[],
  hint: { assetId?: string; name?: string; label?: string; imageIndex?: number }
): PromptAssetItem | undefined {
  if (hint.assetId) {
    const byId = assets.find((a) => a.assetId === hint.assetId)
    if (byId) return byId
  }
  if (hint.imageIndex != null) {
    const byIdx = assets.find((a) => a.imageIndex === hint.imageIndex)
    if (byIdx) return byIdx
  }
  const name = hint.name ? stripAt(hint.name) : ''
  if (name) {
    const byName = assets.find((a) => a.name === name || stripAt(a.label) === name)
    if (byName) return byName
  }
  const label = hint.label ? stripAt(hint.label) : ''
  if (label) {
    return assets.find((a) => stripAt(a.label) === label || a.name === label)
  }
  return undefined
}

/** 编辑器 HTML → 接口纯文本（@图片N[name]） */
export function storyboardPromptHtmlToPlain(html: string): string {
  if (!html?.trim()) return ''
  if (!import.meta.client) {
    return html.replace(/<[^>]+>/g, '').trim()
  }
  try {
    const doc = new DOMParser().parseFromString(`<div id="sp-root">${html}</div>`, 'text/html')
    const root = doc.getElementById('sp-root')
    if (!root) return htmlToPlainFallback(html)

    const walk = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
      if (!(node instanceof HTMLElement)) return ''
      if (node.classList.contains('scp-prompt-asset-ref')) {
        const idx = Number(node.dataset.imageIndex)
        const name = node.dataset.name || node.dataset.label || ''
        if (Number.isFinite(idx) && idx > 0 && name) {
          return formatAssetApiPlaceholder(idx, stripAt(name))
        }
        const label = (node.querySelector('.scp-prompt-asset-ref__label')?.textContent ?? '').trim()
        if (label) return label.startsWith('@') ? label : `@${label}`
        return ''
      }
      if (node.classList.contains('scp-prompt-param-ref')) {
        const v = readPromptParamRefFromNode(node)
        return v.label || ''
      }
      let s = ''
      node.childNodes.forEach((c) => {
        s += walk(c)
      })
      if (node.tagName === 'P' || node.tagName === 'BR' || node.tagName === 'DIV') {
        if (node.tagName === 'BR') return '\n'
      }
      return s
    }

    let out = ''
    root.childNodes.forEach((c) => {
      out += walk(c)
      if (c instanceof HTMLElement && c.tagName === 'P') out += '\n'
    })
    return out.replace(/\n+$/, '').trim() || htmlToPlainFallback(html)
  } catch {
    return htmlToPlainFallback(html)
  }
}

function htmlToPlainFallback(html: string): string {
  return html
    .replace(/<span[^>]*class="[^"]*scp-prompt-asset-ref[^"]*"[^>]*data-image-index="(\d+)"[^>]*data-name="([^"]*)"[^>]*>[\s\S]*?<\/span>/gi, (_, n, name) =>
      formatAssetApiPlaceholder(Number(n), name)
    )
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function paramRefFromTag(
  tag: string,
  paramGroups: PromptParamGroup[]
): PromptParamRefValue | undefined {
  const hit = findParamOptionByTag(paramGroups, tag)
  if (!hit) return undefined
  const label = hit.option.value.startsWith('@') ? hit.option.value : `@${hit.option.value}`
  return {
    paramType: hit.group.paramType,
    key: hit.option.key,
    label
  }
}

type PromptPlainSegment =
  | { kind: 'text'; start: number; end: number }
  | { kind: 'param'; start: number; end: number; ref: PromptParamRefValue }
  | { kind: 'asset'; start: number; end: number; item: PromptAssetItem }

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

/** 从纯文本中移除 @图片N[name] 及已知图片名称的 @ 标签（图生视频参考图单独展示，不入描述框） */
export function stripPromptImageAssetPlaceholdersFromPlain(
  plain: string,
  imageNames: string[] = []
): string {
  let text = String(plain || '')
  text = text.replace(API_PLACEHOLDER_RE, '')
  const uniqueNames = [...new Set(imageNames.map((n) => stripAt(n)).filter(Boolean))]
  for (const name of uniqueNames.sort((a, b) => b.length - a.length)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    text = text.replace(new RegExp(`@${escaped}(?=\\s|$|[，,。；;\\n])`, 'g'), '')
  }
  return text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildPromptPlainSegments(
  text: string,
  assets: PromptAssetItem[],
  paramGroups: PromptParamGroup[],
  labeledRanges: ParamRefTextRange[],
  enableAssetRefs = true
): PromptPlainSegment[] {
  const segments: PromptPlainSegment[] = []

  for (const range of labeledRanges) {
    segments.push({
      kind: 'param',
      start: range.start,
      end: range.end,
      ref: range.ref
    })
  }

  if (!enableAssetRefs) {
    segments.sort((a, b) => a.start - b.start || a.end - b.end)
    return segments
  }

  const re = new RegExp(`${API_PLACEHOLDER_RE.source}|${LEGACY_TAG_RE.source}`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const start = m.index
    const end = start + m[0].length
    if (segments.some((s) => rangesOverlap(start, end, s.start, s.end))) continue

    if (m[1] != null && m[2] != null) {
      const imageIndex = Number(m[1])
      const name = m[2]
      const item =
        findPromptAsset(assets, { imageIndex, name }) ||
        ({
          assetId: `placeholder-${imageIndex}-${name}`,
          assetType: 'other' as PromptAssetType,
          name,
          imageIndex,
          url: '',
          label: `@${name}`
        } satisfies PromptAssetItem)
      segments.push({ kind: 'asset', start, end, item })
      continue
    }

    if (m[3]) {
      const tag = m[3]
      const paramRef = paramRefFromTag(tag, paramGroups)
      if (paramRef) {
        segments.push({ kind: 'param', start, end, ref: paramRef })
        continue
      }
      const item =
        findPromptAsset(assets, { label: tag, name: tag }) ||
        findPromptAsset(assets, { assetId: tag })
      if (item) {
        segments.push({ kind: 'asset', start, end, item })
      }
    }
  }

  segments.sort((a, b) => a.start - b.start || a.end - b.end)
  return segments
}

function renderPromptPlainSegments(text: string, segments: PromptPlainSegment[]): string {
  const parts: string[] = []
  let last = 0
  for (const seg of segments) {
    if (seg.start > last) parts.push(escapeHtml(text.slice(last, seg.start)))
    if (seg.kind === 'param') parts.push(promptParamRefSpanHtml(seg.ref))
    else if (seg.kind === 'asset') parts.push(promptAssetRefSpanHtml(promptAssetItemToRefValue(seg.item)))
    last = seg.end
  }
  if (last < text.length) parts.push(escapeHtml(text.slice(last)))
  return parts.join('')
}

/** 接口纯文本 → 编辑器 HTML（含资产块与参数块） */
export function storyboardPromptPlainToHtml(
  plain: string,
  assets: PromptAssetItem[],
  paramGroups: PromptParamGroup[] = [],
  options?: {
    enableVideoLabeledParams?: boolean
    enableImageLabeledParams?: boolean
    /** 为 false 时不渲染 @图片 引用块（图生视频参考图在描述框外单独展示） */
    enableAssetRefs?: boolean
  }
): string {
  const enableAssetRefs = options?.enableAssetRefs !== false
  const text = enableAssetRefs
    ? (plain || '').trim()
    : stripPromptImageAssetPlaceholdersFromPlain(
        plain,
        assets.map((a) => a.name || a.label)
      )
  if (!text) return ''

  const labeledRanges = [
    ...(options?.enableImageLabeledParams
      ? collectImageLabeledParamRefRanges(text, paramGroups)
      : []),
    ...(options?.enableVideoLabeledParams
      ? collectVideoLabeledParamRefRanges(text, paramGroups)
      : [])
  ]

  if (!text.includes('@') && labeledRanges.length === 0) {
    return `<p>${escapeHtml(text)}</p>`
  }

  const segments = buildPromptPlainSegments(
    text,
    enableAssetRefs ? assets : [],
    paramGroups,
    labeledRanges,
    enableAssetRefs
  )
  const body = renderPromptPlainSegments(text, segments)
  return body ? `<p>${body}</p>` : ''
}

export function promptAssetRefSpanHtml(v: PromptAssetRefValue): string {
  const label = v.label || `@${v.name}`
  const url = escapeAttr(v.url || '')
  const attrs = [
    `class="scp-prompt-asset-ref scp-prompt-asset-ref--${v.assetType}"`,
    'contenteditable="false"',
    `data-asset-id="${escapeAttr(v.assetId)}"`,
    `data-asset-type="${escapeAttr(v.assetType)}"`,
    `data-name="${escapeAttr(v.name)}"`,
    `data-image-index="${v.imageIndex}"`,
    `data-url="${url}"`,
    `data-label="${escapeAttr(label)}"`
  ].join(' ')
  return `<span ${attrs}><span class="scp-prompt-asset-ref__label">${escapeHtml(label)}</span></span>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;')
}

/** 从 HTML 提取已引用的 assetId */
export function extractReferencedAssetIdsFromHtml(html: string): Set<string> {
  const ids = new Set<string>()
  if (!html || !import.meta.client) return ids
  try {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
    doc.querySelectorAll('.scp-prompt-asset-ref').forEach((el) => {
      const id = (el as HTMLElement).dataset.assetId
      if (id) ids.add(id)
    })
  } catch {
    /* ignore */
  }
  return ids
}

/** 从 HTML 提取已引用的 @图片N 序号 */
export function extractReferencedImageIndexesFromHtml(html: string): Set<number> {
  const indexes = new Set<number>()
  if (!html || !import.meta.client) return indexes
  try {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
    doc.querySelectorAll('.scp-prompt-asset-ref').forEach((el) => {
      const idx = Number((el as HTMLElement).dataset.imageIndex)
      if (Number.isFinite(idx) && idx > 0) indexes.add(idx)
    })
  } catch {
    /* ignore */
  }
  return indexes
}

export function plainTextLengthForPrompt(htmlOrPlain: string): number {
  return storyboardPromptHtmlToPlain(htmlOrPlain).length
}

function stripPromptParagraphWrapper(html: string): string {
  const m = html.match(/^<p>([\s\S]*)<\/p>$/i)
  return m ? m[1]! : html
}

function inlinePromptChunkToHtml(
  chunk: string,
  assets: PromptAssetItem[],
  paramGroups: PromptParamGroup[],
  options?: {
    enableVideoLabeledParams?: boolean
    enableImageLabeledParams?: boolean
    enableAssetRefs?: boolean
  }
): string {
  const t = String(chunk || '')
  if (!t.trim()) return ''
  const hasRefs =
    t.includes('@') ||
    (options?.enableVideoLabeledParams && plainHasVideoLabeledParamFields(t)) ||
    (options?.enableImageLabeledParams && plainHasImageLabeledParamFields(t))
  if (!hasRefs) {
    const md = markdownToStoryScriptEditorHtml(t)
    if (md) return md.replace(/^<p>([\s\S]*)<\/p>$/i, '$1') || escapeHtml(t)
    return escapeHtml(t)
  }
  return stripPromptParagraphWrapper(storyboardPromptPlainToHtml(t, assets, paramGroups, options))
}

function renderMarkdownBlocksWithPromptRefs(
  plain: string,
  assets: PromptAssetItem[],
  paramGroups: PromptParamGroup[],
  options?: {
    enableVideoLabeledParams?: boolean
    enableImageLabeledParams?: boolean
    enableAssetRefs?: boolean
  }
): string {
  const lines = plain.split('\n')
  const blocks: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i += 1
      continue
    }

    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headerMatch) {
      const level = headerMatch[1].length
      const titleHtml = inlinePromptChunkToHtml(headerMatch[2], assets, paramGroups, options)
      blocks.push(`<h${level}>${titleHtml}</h${level}>`)
      i += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i += 1
      }
      blocks.push(
        `<blockquote><p>${quoteLines
          .map((q) => inlinePromptChunkToHtml(q, assets, paramGroups, options))
          .join('<br/>')}</p></blockquote>`
      )
      continue
    }

    if (/^[-*+]\s/.test(line) || /^\d+\.\s/.test(line)) {
      const items: string[] = []
      const ordered = /^\d+\.\s/.test(line)
      while (i < lines.length && (/^[-*+]\s/.test(lines[i]) || /^\d+\.\s/.test(lines[i]))) {
        items.push(lines[i].replace(/^([-*+]|\d+\.)\s+/, ''))
        i += 1
      }
      const tag = ordered ? 'ol' : 'ul'
      blocks.push(
        `<${tag}>${items
          .map((it) => `<li>${inlinePromptChunkToHtml(it, assets, paramGroups, options)}</li>`)
          .join('')}</${tag}>`
      )
      continue
    }

    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^[-*+]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^>\s?/.test(lines[i])
    ) {
      paraLines.push(lines[i])
      i += 1
    }
    blocks.push(
      `<p>${inlinePromptChunkToHtml(paraLines.join('\n'), assets, paramGroups, options)}</p>`
    )
  }

  return blocks.join('')
}

/** 多参生视频等：Markdown 结构（# 标题 / 列表）+ @图片 / 结构化参数字段 */
export function storyboardPromptMarkdownPlainToHtml(
  plain: string,
  assets: PromptAssetItem[],
  paramGroups: PromptParamGroup[] = [],
  options?: {
    enableVideoLabeledParams?: boolean
    enableImageLabeledParams?: boolean
    enableAssetRefs?: boolean
  }
): string {
  const enableAssetRefs = options?.enableAssetRefs !== false
  const text = enableAssetRefs
    ? (plain || '').trim()
    : stripPromptImageAssetPlaceholdersFromPlain(
        plain,
        assets.map((a) => a.name || a.label)
      )
  if (!text) return ''

  const needsInlineRefs =
    text.includes('@') ||
    (options?.enableVideoLabeledParams && plainHasVideoLabeledParamFields(text)) ||
    (options?.enableImageLabeledParams && plainHasImageLabeledParamFields(text))

  if (looksLikeMarkdown(text)) {
    if (needsInlineRefs) return renderMarkdownBlocksWithPromptRefs(text, assets, paramGroups, options)
    return markdownToStoryScriptEditorHtml(text)
  }

  return storyboardPromptPlainToHtml(text, assets, paramGroups, options)
}
