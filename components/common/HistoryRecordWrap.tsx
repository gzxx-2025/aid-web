'use client'

import type { CSSProperties,MouseEvent as ReactMouseEvent,ReactNode } from 'react'
import { useEffect,useRef,useState } from 'react'
import { createPortal } from 'react-dom'
import '~/assets/css/history-record-card.css'
import './HistoryRecordWrap.css'

export interface HistoryRecordWrapProps {
  showSetMain?: boolean
  setMainLabel?: string
  setMainLoading?: boolean
  onSetMain?: () => void
  children?: ReactNode
}

/** 悬浮按钮的过渡阶段（对应原 <Transition name="history-set-main-btn-fade">） */
type BtnPhase = 'hidden' | 'enter-from' | 'shown' | 'leaving'

const BTN_FADE_CLASS: Record<Exclude<BtnPhase, 'hidden'>, string> = {
  'enter-from': 'history-set-main-btn-fade-enter-active history-set-main-btn-fade-enter-from',
  shown: 'history-set-main-btn-fade-enter-active',
  leaving: 'history-set-main-btn-fade-leave-active history-set-main-btn-fade-leave-to'
}

/** 过渡时长 220ms + 余量 */
const BTN_LEAVE_MS = 240

/** 生成记录卡片包装：悬停在卡片右侧浮出「设为主图」按钮（teleport 到 body） */
export function HistoryRecordWrap({
  showSetMain,
  setMainLabel,
  setMainLoading,
  onSetMain,
  children
}: HistoryRecordWrapProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [btnPhase, setBtnPhase] = useState<BtnPhase>('hidden')
  const [btnStyle, setBtnStyle] = useState<CSSProperties>({})

  const hideTimerRef = useRef<number | null>(null)
  const leaveTimerRef = useRef<number | null>(null)

  function clearHideTimer() {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  function clearLeaveTimer() {
    if (leaveTimerRef.current != null) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
  }

  function updateBtnPos() {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setBtnStyle({
      top: `${rect.top + rect.height / 2}px`,
      left: `${rect.right + 6}px`
    })
  }

  function beginLeave() {
    setBtnPhase((phase) => (phase === 'hidden' ? phase : 'leaving'))
    clearLeaveTimer()
    leaveTimerRef.current = window.setTimeout(() => {
      leaveTimerRef.current = null
      setBtnPhase('hidden')
    }, BTN_LEAVE_MS)
  }

  function showBtn() {
    clearHideTimer()
    if (!showSetMain) return
    clearLeaveTimer()
    setBtnPhase((phase) => (phase === 'hidden' ? 'enter-from' : 'shown'))
    updateBtnPos()
  }

  function scheduleHide() {
    clearHideTimer()
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null
      beginLeave()
    }, 80)
  }

  function handleSetMainClick(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    onSetMain?.()
  }

  // enter-from → 下一帧移除，触发淡入过渡
  useEffect(() => {
    if (btnPhase !== 'enter-from') return
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setBtnPhase((phase) => (phase === 'enter-from' ? 'shown' : phase))
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [btnPhase])

  // showSetMain 关闭时收起按钮（带淡出）
  useEffect(() => {
    if (showSetMain) return
    clearHideTimer()
    beginLeave()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSetMain])

  const btnActive = btnPhase === 'enter-from' || btnPhase === 'shown'

  useEffect(() => {
    if (!btnActive) return
    const onScrollOrResize = () => updateBtnPos()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [btnActive])

  useEffect(() => {
    return () => {
      clearHideTimer()
      clearLeaveTimer()
    }
  }, [])

  return (
    <div
      ref={wrapRef}
      className="history-record-wrap"
      onMouseEnter={showBtn}
      onMouseLeave={scheduleHide}
    >
      {children}
      {btnPhase !== 'hidden' && typeof document !== 'undefined'
        ? createPortal(
            <button
              type="button"
              className={`history-set-main-btn history-set-main-btn--floating ${BTN_FADE_CLASS[btnPhase]}`}
              style={btnStyle}
              disabled={setMainLoading}
              onMouseEnter={showBtn}
              onMouseLeave={scheduleHide}
              onClick={handleSetMainClick}
            >
              {setMainLabel}
            </button>,
            document.body
          )
        : null}
    </div>
  )
}
