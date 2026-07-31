import { inject } from 'vue'
import { createFlowShellKey, type CreateFlowShellContext } from '~/utils/createFlowInjection'

export function useCreateFlowShell(): CreateFlowShellContext {
  const ctx = inject(createFlowShellKey)
  if (!ctx) {
    throw new Error('useCreateFlowShell: 必须在创作流程布局内使用')
  }
  return ctx
}
