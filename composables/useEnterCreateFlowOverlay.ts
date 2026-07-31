/**
 * 跨壳层进入创作流程时的全屏遮罩开关。
 * 供「我的作品」等入口在 hydrate / 解析路由阶段提前拉起，
 * 由 app.vue 在页面真正就绪（page:finish）后关闭。
 */
export function useEnterCreateFlowOverlay() {
  const pending = useState('enter-create-flow-overlay', () => false)

  function beginEnterCreateFlowOverlay() {
    pending.value = true
  }

  function endEnterCreateFlowOverlay() {
    pending.value = false
  }

  return {
    enterCreateFlowOverlayPending: pending,
    beginEnterCreateFlowOverlay,
    endEnterCreateFlowOverlay
  }
}
