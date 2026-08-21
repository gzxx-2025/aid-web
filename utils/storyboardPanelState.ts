import { useCreationStore } from '~/stores/creation'

/** 删除全部分镜后，原子清空脚本、视频、配音三个步骤的本地面板状态。 */
export function clearAllStoryboardStepPanels(): void {
  useCreationStore.setState((state) => ({
    formData: {
      ...state.formData,
      storyboardScript: { ...state.formData.storyboardScript, panels: [] },
      storyboardVideo: { ...state.formData.storyboardVideo, panels: [] },
      dubbing: { ...state.formData.dubbing, panels: [] }
    },
    manualStoryboardIds: []
  }))
}
