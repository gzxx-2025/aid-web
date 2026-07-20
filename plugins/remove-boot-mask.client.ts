/**
 * 客户端样式与 Vue 挂载就绪后淡出首屏遮罩，减轻刷新时的无样式闪烁（FOUC）
 */
export default defineNuxtPlugin((nuxtApp) => {
  const hideBoot = () => {
    const el = document.getElementById('__nuxt-boot')
    if (!el || el.classList.contains('__nuxt-boot--hide')) return
    el.classList.add('__nuxt-boot--hide')
    const remove = () => {
      el.remove()
    }
    el.addEventListener('transitionend', remove, { once: true })
    setTimeout(remove, 400)
  }

  nuxtApp.hook('app:mounted', () => {
    const run = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(hideBoot)
      })
    }
    if (document.readyState === 'complete') {
      run()
    } else {
      window.addEventListener('load', run, { once: true })
      setTimeout(run, 1200)
    }
  })
})
