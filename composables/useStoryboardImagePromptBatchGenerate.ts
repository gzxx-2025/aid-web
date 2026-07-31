import { useStoryboardImageBatchGenerate } from '~/composables/useStoryboardImageBatchGenerate'
import type { StoryboardPanel } from '~/types'

/** @deprecated 兼容旧 import 名，请改用 useStoryboardImageBatchGenerate */
export function useStoryboardImagePromptBatchGenerate() {
  const batch = useStoryboardImageBatchGenerate()
  return {
    runBatchImagePromptForPanels: (
      panels: StoryboardPanel[],
      overwrite: boolean,
      options?: { manualAgentModelPick?: boolean }
    ) => batch.runBatchForPanels(panels, overwrite, options)
  }
}
