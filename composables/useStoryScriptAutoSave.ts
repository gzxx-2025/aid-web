import { watch, onBeforeUnmount, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { useCreationStore } from '~/stores/creation'
import { userScriptAutoSave } from '~/utils/businessApi'
import { storyScriptOriginalTextForApi } from '~/utils/htmlPlain'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'

const DEBOUNCE_MS = 10_000

/**
 * 剧本静默保存：内容变化后若连续无新改动，且与已同步 Markdown 不一致，则调用 autoSave。
 * 编辑器仍保留 HTML，仅接口 originalText 传 Markdown。
 */
export function useStoryScriptAutoSave(htmlContent: Ref<string>) {
  if (import.meta.server) {
    return {
      flushAutoSave: async () => {},
      clearAutoSaveTimer: () => {}
    }
  }

  const route = useRoute()
  const creationStore = useCreationStore()
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  async function runAutoSave() {
    const html = htmlContent.value.trim()
    const apiText = storyScriptOriginalTextForApi(html)
    if (apiText === creationStore.scriptServerHtmlBaseline) return

    const ctx = await resolveStoryScriptSaveContext(creationStore, route)
    if (!ctx) return

    try {
      const row = await userScriptAutoSave({ ...ctx, originalText: apiText })
      const synced = (row.originalText ?? apiText).trim()
      creationStore.setScriptServerHtmlBaseline(synced)
    } catch (e: unknown) {
      const err = e as { msg?: string; message?: string }
      message.error(err?.msg || err?.message || '静默保存剧本失败')
    }
  }

  function scheduleAutoSave() {
    clearTimer()
    timer = setTimeout(() => {
      timer = null
      void runAutoSave()
    }, DEBOUNCE_MS)
  }

  watch(htmlContent, () => {
    scheduleAutoSave()
  })

  onBeforeUnmount(() => {
    clearTimer()
  })

  return { flushAutoSave: runAutoSave, clearAutoSaveTimer: clearTimer }
}
