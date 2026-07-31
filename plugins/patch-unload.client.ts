/**
 * Chrome 对 unload 有 Permissions-Policy 限制，依赖若仍注册会刷控制台 Violation。
 * 将 unload 监听改挂到 pagehide（BFCache 友好），保留清理逻辑且不再触发违规日志。
 */
export default defineNuxtPlugin({
  name: 'patch-unload',
  enforce: 'pre',
  setup() {
    if (!import.meta.client) return

    const proto = EventTarget.prototype
    const originalAdd = proto.addEventListener
    const originalRemove = proto.removeEventListener

    proto.addEventListener = function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ) {
      if (type === 'unload') {
        return originalAdd.call(this, 'pagehide', listener as EventListener, options)
      }
      return originalAdd.call(this, type, listener as EventListener, options)
    }

    proto.removeEventListener = function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions
    ) {
      if (type === 'unload') {
        return originalRemove.call(this, 'pagehide', listener as EventListener, options)
      }
      return originalRemove.call(this, type, listener as EventListener, options)
    }
  }
})
