/**
 * 首页首屏（Hero Banner 预加载）就绪信号。
 * 供侧栏邀请卡等「等首页内容出来后再出现」的浮层共用。
 */
const homeHeroContentReady = ref(false)

export function useHomeHeroContentReady() {
  function markHomeHeroContentReady(ready: boolean) {
    homeHeroContentReady.value = ready
  }

  return {
    homeHeroContentReady: readonly(homeHeroContentReady),
    markHomeHeroContentReady
  }
}
