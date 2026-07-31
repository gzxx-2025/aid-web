import { ref, watch } from 'vue'
import type { StoryboardPanel, StoryboardVideoPanel, DubbingPanel } from '~/types'
import { useCreationStore } from '~/stores/creation'
import { parseServerStoryboardId } from '~/composables/useStoryboardWorkbenchMutations'
import { stripStoryboardScriptSkeletonPanels } from '~/utils/storyboardPanelMap'
import {
  extractStoryboardTitleSuffix,
  formatStoryboardDubbingTitle,
  formatStoryboardScriptTitle,
  formatStoryboardVideoTitle
} from '~/utils/storyboardPanelTitle'
import { requestCreateFlowStepModal } from '~/utils/createFlowStepModalIntent'
import {
  buildMainVideoItemFromFinalUrl,
  ensureVideosFromFinalVideoUrl
} from '~/utils/storyboardVideoPanelSeed'

function titleSuffixFromScriptPanel(p: StoryboardPanel): string {
  return extractStoryboardTitleSuffix(p.title)
}

export function createDefaultVideoPanel(p: StoryboardPanel, i: number): StoryboardVideoPanel {
  const suffix = titleSuffixFromScriptPanel(p)
  const finalVideoUrl = p.finalVideoUrl != null ? String(p.finalVideoUrl).trim() : ''
  const finalVideoId =
    p.finalVideoId != null && Number(p.finalVideoId) > 0 ? Number(p.finalVideoId) : null
  const seeded = buildMainVideoItemFromFinalUrl({
    finalVideoUrl,
    finalVideoId,
    storyboardId: p.id,
    title: '分镜原视频'
  })
  return {
    id: `video-${p.id || Date.now()}-${i}`,
    title: formatStoryboardVideoTitle(i, suffix),
    videoMode: '多参',
    detailDescription: '可点击「自动生成分镜视频」或「编辑分镜视频」生成视频',
    finalVideoUrl: finalVideoUrl || undefined,
    videos: seeded ? [seeded] : []
  }
}

function dubbingTypeFromVoiceType(voiceType?: string | null): string {
  const t = String(voiceType || '').trim().toLowerCase()
  if (t === 'dialogue') return '角色对白'
  if (t === 'mixed') return '旁白+对白'
  return '旁白/画外音'
}

function speakerRoleFromStoryboardPanel(p: StoryboardPanel): string {
  const roles = Array.isArray(p.speakerRoles) ? p.speakerRoles : []
  const firstRole = String(roles[0] || '').trim()
  if (firstRole) return firstRole
  const voices = Array.isArray(p.speakerVoices) ? p.speakerVoices : []
  const fromVoice = String(voices[0]?.roleName || '').trim()
  return fromVoice || '旁白'
}

function dubbingStatusFromStoryboardPanel(p: StoryboardPanel): 'pending' | 'done' {
  const audioStatus = String(p.audioStatus || '').trim().toUpperCase()
  if (audioStatus === 'SUCCEEDED') return 'done'
  const composeUrl =
    p.finalComposeVideoUrl != null ? String(p.finalComposeVideoUrl).trim() : ''
  return composeUrl ? 'done' : 'pending'
}

export function createDefaultDubbingPanel(p: StoryboardPanel, i: number): DubbingPanel {
  const suffix = titleSuffixFromScriptPanel(p)
  const dialogueRaw =
    p.dialogueText != null && String(p.dialogueText).trim() ? String(p.dialogueText).trim() : ''
  const subtitleRaw =
    p.subtitleText != null && String(p.subtitleText).trim() ? String(p.subtitleText).trim() : ''
  const composeUrl =
    p.finalComposeVideoUrl != null ? String(p.finalComposeVideoUrl).trim() : ''
  const status = dubbingStatusFromStoryboardPanel(p)
  const primaryVoice = Array.isArray(p.speakerVoices) ? p.speakerVoices[0] : null
  return {
    id: `dubbing-${p.id || Date.now()}-${i}`,
    title: formatStoryboardDubbingTitle(i, suffix),
    dialogue: dialogueRaw,
    subtitleText: subtitleRaw || undefined,
    dubbingType: dubbingTypeFromVoiceType(p.voiceType),
    speakerRole: speakerRoleFromStoryboardPanel(p),
    status,
    dubbingVoiceName: primaryVoice?.voiceName ? String(primaryVoice.voiceName) : undefined,
    ...(status === 'done' && composeUrl
      ? {
          dubbingLipSyncVideoUrl: composeUrl,
          storyboardDubbingConfirmed: true as const
        }
      : {})
  }
}

function createDefaultScriptPanel(i: number): StoryboardPanel {
  return {
    id: `${Date.now()}-${i + 1}-${Math.random().toString(36).slice(2, 9)}`,
    title: formatStoryboardScriptTitle(i)
  }
}

function findPanelIndexByScriptId<T extends { id: string }>(
  panels: T[],
  scriptId: string
): number {
  const sid = String(scriptId)
  const byEmbed = panels.findIndex((p) => p.id.includes(sid))
  if (byEmbed >= 0) return byEmbed
  return -1
}

/** 按脚本列表顺序对齐视频/配音，并统一重算三处序号标题 */
export function buildVideoAndDubbingPanelsFromScript(
  scriptPanels: StoryboardPanel[],
  videoPanels: StoryboardVideoPanel[],
  dubbingPanels: DubbingPanel[]
): { video: StoryboardVideoPanel[]; dubbing: DubbingPanel[] } {
  const nextVideo: StoryboardVideoPanel[] = []
  const nextDubbing: DubbingPanel[] = []
  const usedVideo = new Set<number>()
  const usedDubbing = new Set<number>()

  for (let i = 0; i < scriptPanels.length; i++) {
    const p = scriptPanels[i]!
    const suffix = titleSuffixFromScriptPanel(p)
    const scriptId = String(p.id)

    let vi = findPanelIndexByScriptId(videoPanels, scriptId)
    if (vi < 0 && i < videoPanels.length && !usedVideo.has(i)) vi = i
    let di = findPanelIndexByScriptId(dubbingPanels, scriptId)
    if (di < 0 && i < dubbingPanels.length && !usedDubbing.has(i)) di = i

    const existingVideo = vi >= 0 ? videoPanels[vi] : null
    const existingDubbing = di >= 0 ? dubbingPanels[di] : null
    if (vi >= 0) usedVideo.add(vi)
    if (di >= 0) usedDubbing.add(di)

    nextVideo.push(
      existingVideo
        ? ensureVideosFromFinalVideoUrl(
            {
              ...existingVideo,
              title: formatStoryboardVideoTitle(i, suffix),
              finalVideoUrl:
                (p.finalVideoUrl != null && String(p.finalVideoUrl).trim()) ||
                existingVideo.finalVideoUrl ||
                undefined
            },
            {
              scriptFinalVideoUrl: p.finalVideoUrl,
              scriptFinalVideoId:
                p.finalVideoId != null && Number(p.finalVideoId) > 0
                  ? Number(p.finalVideoId)
                  : null,
              title: '分镜原视频'
            }
          )
        : createDefaultVideoPanel(p, i)
    )

    const fromScript = (p.dialogueText ?? '').trim()
    const fromSubtitle = (p.subtitleText ?? '').trim()
    const fromCompose =
      p.finalComposeVideoUrl != null ? String(p.finalComposeVideoUrl).trim() : ''
    const prevDialogue = (existingDubbing?.dialogue ?? '').trim()
    const prevSubtitle = (existingDubbing?.subtitleText ?? '').trim()
    const serverStatus = dubbingStatusFromStoryboardPanel(p)
    const primaryVoice = Array.isArray(p.speakerVoices) ? p.speakerVoices[0] : null
    nextDubbing.push(
      existingDubbing
        ? {
            ...existingDubbing,
            title: formatStoryboardDubbingTitle(i, suffix),
            dialogue: prevDialogue || fromScript || existingDubbing.dialogue || '',
            subtitleText: fromSubtitle || prevSubtitle || existingDubbing.subtitleText || undefined,
            dubbingType: dubbingTypeFromVoiceType(p.voiceType) || existingDubbing.dubbingType,
            speakerRole: speakerRoleFromStoryboardPanel(p) || existingDubbing.speakerRole,
            dubbingVoiceName:
              (primaryVoice?.voiceName && String(primaryVoice.voiceName)) ||
              existingDubbing.dubbingVoiceName,
            status: serverStatus === 'done' || existingDubbing.status === 'done' ? 'done' : 'pending',
            ...(fromCompose
              ? {
                  dubbingLipSyncVideoUrl: fromCompose,
                  status: 'done' as const,
                  storyboardDubbingConfirmed: true as const
                }
              : {})
          }
        : createDefaultDubbingPanel(p, i)
    )
  }

  return { video: nextVideo, dubbing: nextDubbing }
}

/** 仅重算脚本列表内每条 title 的序号（保留冒号后名称） */
export function renumberStoryboardScriptPanelTitles(panels: StoryboardPanel[]): StoryboardPanel[] {
  return panels.map((p, i) => ({
    ...p,
    title: formatStoryboardScriptTitle(i, titleSuffixFromScriptPanel(p))
  }))
}

let storyboardPanelSyncDepth = 0

function runWithStoryboardPanelSyncLock(fn: () => void) {
  storyboardPanelSyncDepth += 1
  try {
    fn()
  } finally {
    storyboardPanelSyncDepth -= 1
  }
}

function hasPersistedStoryboardScriptPanels(panels: StoryboardPanel[]): boolean {
  return panels.some((p) => parseServerStoryboardId(p.id) != null)
}

function applyVideoAndDubbingFromScriptInternal(
  creationStore: ReturnType<typeof useCreationStore>,
  scriptPanels: StoryboardPanel[]
) {
  if (!scriptPanels?.length) {
    creationStore.formData.storyboardVideo.panels = []
    creationStore.formData.dubbing.panels = []
    return
  }
  const { video, dubbing } = buildVideoAndDubbingPanelsFromScript(
    scriptPanels,
    creationStore.formData.storyboardVideo.panels as StoryboardVideoPanel[],
    creationStore.formData.dubbing.panels as DubbingPanel[]
  )
  creationStore.formData.storyboardVideo.panels = video
  creationStore.formData.dubbing.panels = dubbing
}

/**
 * 以 /api/user/storyboard/list 结果为唯一数据源写入脚本，并重置 video/dubbing 联动。
 * 生成任务刷新、页面 list 拉取均应走此入口，避免旧 video/dubbing 反向补全 phantom 分镜行。
 */
export function applyStoryboardScriptPanelsFromApi(scriptPanels: StoryboardPanel[]) {
  const creationStore = useCreationStore()
  const cleaned = stripStoryboardScriptSkeletonPanels(scriptPanels || [])
  runWithStoryboardPanelSyncLock(() => {
    if (!cleaned.length) {
      creationStore.formData.storyboardScript.panels = []
      creationStore.formData.storyboardVideo.panels = []
      creationStore.formData.dubbing.panels = []
      return
    }
    const renumbered = renumberStoryboardScriptPanelTitles(cleaned)
    creationStore.formData.storyboardScript.panels = renumbered
    creationStore.pruneManualStoryboardIds(
      renumbered
        .map((p) => parseServerStoryboardId(p.id))
        .filter((id): id is number => id != null)
    )
    const { video, dubbing } = buildVideoAndDubbingPanelsFromScript(renumbered, [], [])
    creationStore.formData.storyboardVideo.panels = video
    creationStore.formData.dubbing.panels = dubbing
  })
}

/**
 * 分镜脚本 / 分镜视频 / 配音列表联动同步（原 index.vue 内 watch 逻辑）
 */
export function useCreateFlowStoryboardSync() {
  const creationStore = useCreationStore()

  const storyboardScriptTooltipTargetIndex = ref<number | null>(null)
  const storyboardScriptTooltipKey = ref(0)

  function handleJumpToStoryboardScriptFromVideo(panelIndex: number) {
    // 跨步骤开窗：视频页 → 分镜设计并打开「编辑分镜图」（可整段卸载 createFlowStepModalIntent）
    requestCreateFlowStepModal('storyboard-image', panelIndex)
  }

  function clearStoryboardScriptJumpTooltip() {
    storyboardScriptTooltipTargetIndex.value = null
  }

  function isSameStoryboardScriptStructure(
    next: StoryboardPanel[],
    prev: StoryboardPanel[]
  ): boolean {
    if (next.length !== prev.length) return false
    return next.every((p, i) => p.id === prev[i]?.id)
  }

  function applyVideoAndDubbingFromScript(scriptPanels: StoryboardPanel[]) {
    applyVideoAndDubbingFromScriptInternal(creationStore, scriptPanels)
  }

  function syncVideoAndDubbingFromScriptPanels(scriptPanels: StoryboardPanel[]) {
    applyStoryboardScriptPanelsFromApi(scriptPanels)
  }

  /** 接口拉取脚本列表后：重算脚本序号并同步视频/配音标题 */
  function normalizeVideoAndDubbingTitlesFromScript(scriptPanels: StoryboardPanel[]) {
    if (!scriptPanels?.length) return
    runWithStoryboardPanelSyncLock(() => {
      const renumbered = renumberStoryboardScriptPanelTitles(scriptPanels)
      creationStore.formData.storyboardScript.panels = renumbered
      applyVideoAndDubbingFromScriptInternal(creationStore, renumbered)
    })
  }

  watch(
    () => creationStore.formData.storyboardScript.panels as StoryboardPanel[],
    (newScriptPanels, oldScriptPanels) => {
      if (storyboardPanelSyncDepth > 0) return
      const scriptPanels = (newScriptPanels || []) as StoryboardPanel[]
      const oldScript = (oldScriptPanels || []) as StoryboardPanel[]

      if (scriptPanels.length === 0) {
        runWithStoryboardPanelSyncLock(() => {
          creationStore.formData.storyboardVideo.panels = []
          creationStore.formData.dubbing.panels = []
        })
        return
      }

      runWithStoryboardPanelSyncLock(() => {
        const renumbered = renumberStoryboardScriptPanelTitles(scriptPanels)
        const titlesChanged = renumbered.some((p, i) => p.title !== scriptPanels[i]?.title)
        const structureChanged = !isSameStoryboardScriptStructure(renumbered, oldScript)
        const lengthChanged = scriptPanels.length !== oldScript.length
        /** 仅结构/序号变化时联动 video/dubbing，避免分镜图等 deep 字段更新触发整表重建死循环 */
        const shouldSyncVideoAndDubbing = structureChanged || titlesChanged || lengthChanged
        if (structureChanged || titlesChanged) {
          creationStore.formData.storyboardScript.panels = renumbered
        }
        if (shouldSyncVideoAndDubbing) {
          applyVideoAndDubbingFromScriptInternal(creationStore, renumbered)
        }
      })
    },
    { deep: true }
  )

  watch(
    () => creationStore.formData.storyboardVideo.panels,
    (newVideoPanels, oldVideoPanels) => {
      if (storyboardPanelSyncDepth > 0) return
      const videoPanels = newVideoPanels || []
      const oldVideo = oldVideoPanels || []
      const scriptPanels = creationStore.formData.storyboardScript.panels as StoryboardPanel[]
      const dubbingPanels = creationStore.formData.dubbing.panels

      if (videoPanels.length > scriptPanels.length) {
        if (hasPersistedStoryboardScriptPanels(scriptPanels)) {
          runWithStoryboardPanelSyncLock(() => {
            applyVideoAndDubbingFromScriptInternal(creationStore, scriptPanels)
          })
          return
        }
        const toAdd = videoPanels.length - scriptPanels.length
        const newScripts: StoryboardPanel[] = [...scriptPanels]
        const newDubbing: DubbingPanel[] = [...dubbingPanels]
        for (let i = 0; i < toAdd; i++) {
          const idx = scriptPanels.length + i
          newScripts.push(createDefaultScriptPanel(idx))
          const p = newScripts[newScripts.length - 1]!
          newDubbing.push(createDefaultDubbingPanel(p, idx))
        }
        runWithStoryboardPanelSyncLock(() => {
          creationStore.formData.storyboardScript.panels = renumberStoryboardScriptPanelTitles(newScripts)
          creationStore.formData.dubbing.panels = newDubbing
        })
        return
      }

      if (videoPanels.length < scriptPanels.length && oldVideo.length > 0) {
        const newIds = new Set((videoPanels as StoryboardVideoPanel[]).map((v) => v.id))
        const removedIndices: number[] = []
        oldVideo.forEach((v, i) => {
          if (!newIds.has(v.id)) removedIndices.push(i)
        })
        if (removedIndices.length > 0) {
          const nextScript = scriptPanels.filter((_, i) => !removedIndices.includes(i))
          const nextDubbing = dubbingPanels.filter((_, i) => !removedIndices.includes(i))
          runWithStoryboardPanelSyncLock(() => {
            creationStore.formData.storyboardScript.panels =
              renumberStoryboardScriptPanelTitles(nextScript)
            creationStore.formData.dubbing.panels = nextDubbing.map((d, i) => ({
              ...d,
              title: formatStoryboardDubbingTitle(i, extractStoryboardTitleSuffix(d.title))
            }))
          })
        }
      }
    },
    { deep: true }
  )

  watch(
    () => creationStore.formData.dubbing.panels,
    (newDubbingPanels, oldDubbingPanels) => {
      if (storyboardPanelSyncDepth > 0) return
      const dubbingPanels = newDubbingPanels || []
      const oldDubbing = oldDubbingPanels || []
      const scriptPanels = creationStore.formData.storyboardScript.panels as StoryboardPanel[]
      const videoPanels = creationStore.formData.storyboardVideo.panels

      if (dubbingPanels.length > scriptPanels.length) {
        if (hasPersistedStoryboardScriptPanels(scriptPanels)) {
          runWithStoryboardPanelSyncLock(() => {
            applyVideoAndDubbingFromScriptInternal(creationStore, scriptPanels)
          })
          return
        }
        const toAdd = dubbingPanels.length - scriptPanels.length
        const newScripts: StoryboardPanel[] = [...scriptPanels]
        const newVideo: StoryboardVideoPanel[] = [...videoPanels]
        for (let i = 0; i < toAdd; i++) {
          const idx = scriptPanels.length + i
          newScripts.push(createDefaultScriptPanel(idx))
          const p = newScripts[newScripts.length - 1]!
          newVideo.push(createDefaultVideoPanel(p, idx))
        }
        runWithStoryboardPanelSyncLock(() => {
          creationStore.formData.storyboardScript.panels = renumberStoryboardScriptPanelTitles(newScripts)
          creationStore.formData.storyboardVideo.panels = newVideo
        })
        return
      }

      if (dubbingPanels.length < scriptPanels.length && oldDubbing.length > 0) {
        const newIds = new Set((dubbingPanels as DubbingPanel[]).map((d) => d.id))
        const removedIndices: number[] = []
        oldDubbing.forEach((d, i) => {
          if (!newIds.has(d.id)) removedIndices.push(i)
        })
        if (removedIndices.length > 0) {
          const nextScript = scriptPanels.filter((_, i) => !removedIndices.includes(i))
          const nextVideo = videoPanels.filter((_, i) => !removedIndices.includes(i))
          runWithStoryboardPanelSyncLock(() => {
            creationStore.formData.storyboardScript.panels =
              renumberStoryboardScriptPanelTitles(nextScript)
            creationStore.formData.storyboardVideo.panels = nextVideo.map((v, i) => ({
              ...v,
              title: formatStoryboardVideoTitle(i, extractStoryboardTitleSuffix(v.title))
            }))
          })
        }
      }
    },
    { deep: true }
  )

  return {
    storyboardScriptTooltipTargetIndex,
    storyboardScriptTooltipKey,
    handleJumpToStoryboardScriptFromVideo,
    clearStoryboardScriptJumpTooltip,
    syncVideoAndDubbingFromScriptPanels,
    normalizeVideoAndDubbingTitlesFromScript
  }
}
