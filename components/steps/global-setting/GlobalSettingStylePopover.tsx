'use client'

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject
} from 'react'
import { createPortal } from 'react-dom'
import { toLayoutPx } from '~/utils/viewportZoom'

interface GlobalSettingStylePopoverProps {
  open: boolean
  triggerRef: RefObject<HTMLButtonElement | null>
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

const PANEL_WIDTH = 720
const PANEL_HEIGHT = 620
const PANEL_GAP = 10
const PANEL_Z_INDEX = '12000'
const TRANSITION_DURATION_MS = 180

function nextFrame(callback: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback)
  })
}

/**
 * “更多风格”非模态浮层：交互与灵感空间右侧 SettingSelectField 保持一致，
 * 通过 Portal 避免被创建项目弹窗或设置页滚动容器裁切。
 */
export function GlobalSettingStylePopover({
  open,
  triggerRef,
  onOpenChange,
  children
}: GlobalSettingStylePopoverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const openRef = useRef(open)
  const onOpenChangeRef = useRef(onOpenChange)
  const outsideHandlerRef = useRef<((event: MouseEvent) => void) | null>(null)
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renderedRef = useRef(false)

  const [ready, setReady] = useState(false)
  const [rendered, setRendered] = useState(false)
  const [placement, setPlacement] = useState<'left' | 'right'>('left')
  const [transitionClass, setTransitionClass] = useState('')
  const [panelFixedStyle, setPanelFixedStyle] = useState<CSSProperties>({})

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  }, [onOpenChange])

  function updatePlacement() {
    if (!openRef.current || !triggerRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const panelWidth = Math.min(PANEL_WIDTH, Math.max(0, window.innerWidth - 24))
    const panelHeight = Math.min(PANEL_HEIGHT, Math.max(0, window.innerHeight - 24))

    let nextPlacement: 'left' | 'right' = 'right'
    let left = triggerRect.right + PANEL_GAP
    if (left + panelWidth > window.innerWidth - 12) {
      nextPlacement = 'left'
      left = triggerRect.left - panelWidth - PANEL_GAP
    }
    left = Math.max(12, Math.min(left, window.innerWidth - panelWidth - 12))

    const top = Math.max(
      12,
      Math.min(triggerRect.top, window.innerHeight - panelHeight - 12)
    )

    setPlacement(nextPlacement)
    setPanelFixedStyle({
      position: 'fixed',
      left: `${toLayoutPx(left)}px`,
      top: `${toLayoutPx(top)}px`,
      width: `${toLayoutPx(panelWidth)}px`,
      height: `${toLayoutPx(panelHeight)}px`,
      zIndex: PANEL_Z_INDEX
    })
  }

  function unbindOutsideHandler() {
    if (!outsideHandlerRef.current) return
    document.removeEventListener('mousedown', outsideHandlerRef.current, true)
    outsideHandlerRef.current = null
  }

  function bindOutsideHandler() {
    unbindOutsideHandler()
    outsideHandlerRef.current = (event: MouseEvent) => {
      if (!openRef.current) return
      const target = event.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      onOpenChangeRef.current(false)
    }
    document.addEventListener('mousedown', outsideHandlerRef.current, true)
  }

  useEffect(() => {
    if (!open) {
      setReady(false)
      unbindOutsideHandler()
      return undefined
    }

    setReady(false)
    unbindOutsideHandler()
    let cancelled = false
    requestAnimationFrame(() => {
      if (cancelled) return
      updatePlacement()
      setReady(true)
      requestAnimationFrame(() => {
        if (!cancelled) bindOutsideHandler()
      })
    })
    return () => {
      cancelled = true
    }
    // 与 SettingSelectField 一致，仅在开合时重新执行定位流程。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const visible = open && ready
  useEffect(() => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }

    let cancelled = false
    if (visible) {
      renderedRef.current = true
      setRendered(true)
      setTransitionClass('style-browser-popover-enter-from style-browser-popover-enter-active')
      nextFrame(() => {
        if (cancelled) return
        setTransitionClass('style-browser-popover-enter-active')
        transitionTimerRef.current = setTimeout(() => {
          transitionTimerRef.current = null
          setTransitionClass('')
        }, TRANSITION_DURATION_MS)
      })
      return () => {
        cancelled = true
      }
    }

    if (!renderedRef.current) return undefined
    setTransitionClass('style-browser-popover-leave-active style-browser-popover-leave-to')
    transitionTimerRef.current = setTimeout(() => {
      transitionTimerRef.current = null
      renderedRef.current = false
      setRendered(false)
      setTransitionClass('')
      setPanelFixedStyle({})
    }, TRANSITION_DURATION_MS)
    return () => {
      cancelled = true
    }
  }, [visible])

  useEffect(() => {
    const onViewportChange = () => {
      if (openRef.current) updatePlacement()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openRef.current) onOpenChangeRef.current(false)
    }

    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      unbindOutsideHandler()
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
      document.removeEventListener('keydown', onKeyDown)
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
    }
    // 事件函数通过 ref 获取最新状态与回调。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!rendered || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={panelRef}
      className={[
        'global-setting',
        'global-setting-style-popover',
        `global-setting-style-popover--${placement}`,
        transitionClass
      ]
        .filter(Boolean)
        .join(' ')}
      style={panelFixedStyle}
      role="dialog"
      aria-modal="false"
      aria-label="更多风格"
    >
      {children}
    </div>,
    document.body
  )
}

export default GlobalSettingStylePopover
