import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { GlobalSettingData, StoryboardPanel } from '~/types'
import type { ExtractModalScope } from '~/components/steps/ExtractAgentModal.vue'

/** 创作流程内「全局设定」页状态与保存 */
export interface CreateFlowGlobalSettingContext {
  confirmLoading: Ref<boolean>
  titleDraft: Ref<string>
  projectTypeDraft: Ref<'movie' | 'series'>
  draft: Ref<GlobalSettingData>
  projectTypeLocked: ComputedRef<boolean>
  syncFromStore: () => void
  updateField: <K extends keyof GlobalSettingData>(key: K, value: GlobalSettingData[K]) => void
  patchStyle: (patch: Pick<GlobalSettingData, 'selectedStyle' | 'myStyles' | 'style'>) => void
  save: () => Promise<void>
}

/** 创作壳层提供给子路由页的回调（侧栏、流程条仍在壳内） */
export interface CreateFlowShellContext {
  goToStep: (stepIndex: number) => void
  stopExtractAssets: () => void | Promise<void>
  openExtractModalFromScp: (scope: Exclude<ExtractModalScope, 'all'>) => void
  jumpToStoryboardScriptFromVideo: (panelIndex: number) => void
  clearStoryboardScriptJumpTooltip: () => void
  storyboardScriptTooltipTargetIndex: Ref<number | null>
  storyboardScriptTooltipKey: Ref<number>
  syncVideoAndDubbingFromScriptPanels: (panels: StoryboardPanel[]) => void
  setDubbingGenerating: (v: boolean) => void
  globalSetting: CreateFlowGlobalSettingContext
  openProjectGenConfig: () => void
}

export const createFlowShellKey: InjectionKey<CreateFlowShellContext> = Symbol('createFlowShell')
