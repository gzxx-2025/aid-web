import { Modal } from 'ant-design-vue'
import type { ModalFuncProps } from 'ant-design-vue/es/modal/Modal'
import { withAppConfirmDefaults, type AppConfirmOptions } from '~/utils/appConfirm'

/**
 * 全局替换 Modal.confirm / info / warning / error 的默认图标与样式，
 * 避免 Ant Design 自带红色圆圈感叹号。
 */
export default defineNuxtPlugin(() => {
  const originalConfirm = Modal.confirm
  const originalInfo = Modal.info
  const originalWarning = Modal.warning
  const originalError = Modal.error

  Object.assign(Modal, {
    confirm: (config: ModalFuncProps) =>
      originalConfirm(withAppConfirmDefaults(config as AppConfirmOptions)),
    info: (config: ModalFuncProps) =>
      originalInfo(
        withAppConfirmDefaults({ ...config, confirmVariant: 'info' } as AppConfirmOptions)
      ),
    warning: (config: ModalFuncProps) =>
      originalWarning(
        withAppConfirmDefaults({ ...config, confirmVariant: 'warning' } as AppConfirmOptions)
      ),
    error: (config: ModalFuncProps) =>
      originalError(
        withAppConfirmDefaults({ ...config, confirmVariant: 'danger' } as AppConfirmOptions)
      )
  })
})
