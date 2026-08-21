'use client'

import { message } from 'antd'
import { useEffect,useMemo,useRef } from 'react'
import { getRouteLikeSnapshot } from '~/hooks/useRouteLike'
import { useCreationStore } from '~/stores/creation'
import { userScriptAutoSave } from '~/utils/businessApi'
import { storyScriptOriginalTextForApi } from '~/utils/htmlPlain'
import { resolveStoryScriptSaveContext } from '~/utils/storyScriptSaveContext'

const DEBOUNCE_MS = 10_000

/**
 * 剧本静默保存：内容变化后若连续无新改动，且与已同步 Markdown 不一致，则调用 autoSave。
 * 编辑器仍保留 HTML，仅接口 originalText 传 Markdown。
 */
export function useStoryScriptAutoSave(htmlContent: string) {
  const htmlRef = useRef(htmlContent)
  htmlRef.current = htmlContent

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 原 watch 不带 immediate：跳过首帧，仅在内容变化后调度 */
  const mountedRef = useRef(false)

  const api = useMemo(() => {
    function clearTimer() {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    async function runAutoSave() {
      const creationStore = useCreationStore.getState()
      const html = htmlRef.current.trim()
      const apiText = storyScriptOriginalTextForApi(html)
      if (apiText === creationStore.scriptServerHtmlBaseline) return

      const ctx = await resolveStoryScriptSaveContext(creationStore, getRouteLikeSnapshot())
      if (!ctx) return

      try {
        const row = await userScriptAutoSave({ ...ctx, originalText: apiText })
        const synced = (row.originalText ?? apiText).trim()
        useCreationStore.getState().setScriptServerHtmlBaseline(synced)
      } catch (e: unknown) {
        const err = e as { msg?: string; message?: string }
        message.error(err?.msg || err?.message || '静默保存剧本失败')
      }
    }

    function scheduleAutoSave() {
      clearTimer()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        void runAutoSave()
      }, DEBOUNCE_MS)
    }

    return { runAutoSave, scheduleAutoSave, clearTimer }
  }, [])

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    api.scheduleAutoSave()
  }, [htmlContent, api])

  useEffect(() => {
    return () => {
      api.clearTimer()
    }
  }, [api])

  return { flushAutoSave: api.runAutoSave, clearAutoSaveTimer: api.clearTimer }
}
