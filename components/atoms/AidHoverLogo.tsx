'use client'

import { useEffect,useRef,useState,type CSSProperties } from 'react'
import './AidHoverLogo.css'

/** AID 线稿 logo：入场与 hover / 定时重播时按笔画顺序描边绘制（pathLength 归一化 dash 动画） */
const LOGO_PARTS = [
  {
    id: 'letter-a',
    d: 'M12.6259 20.5236C14.5423 17.1958 19.5084 17.1958 21.4248 20.5236L25.0156 26.7588V35.6172L17.8597 23.0357C17.6218 22.6175 16.9989 22.6156 16.7585 23.0325L10.4222 34.0183H14.9816L16.7769 31.4227C17.0289 31.0584 17.5863 31.0639 17.8305 31.433L19.5407 34.0183L22.0387 38H3.62985C3.15047 38 2.84733 37.504 3.07984 37.1001L12.6259 20.5236Z',
    delayMs: 0
  },
  {
    id: 'letter-i',
    d: 'M25.9589 18.6061C25.9589 18.2713 26.2405 18 26.5878 18H29.732C30.0794 18 30.3609 18.2713 30.3609 18.6061V36.9968C30.3609 37.3315 30.0794 37.6029 29.732 37.6029H26.5878C26.2405 37.6029 25.9589 37.3315 25.9589 36.9968V18.6061Z',
    delayMs: 150
  },
  {
    id: 'letter-d',
    d: 'M42.8287 18C48.4461 18.0001 53 22.3883 53 27.8015C53 33.2146 48.4461 37.6029 42.8287 37.6029H33.1454C33.0401 37.6029 32.9447 37.563 32.8736 37.4985L37.3455 33.7742H42.7516C46.1747 33.7741 48.9497 31.1001 48.9497 27.8015C48.9497 24.5029 46.1747 21.8288 42.7516 21.8287H37.4186L32.8742 18.1033C32.9452 18.0393 33.0405 18 33.1454 18H42.8287Z',
    delayMs: 300
  },
  {
    id: 'letter-d-inner',
    d: 'M41.3448 27.2678L32.8791 21.0629V34.5399L41.3488 28.2297C41.6761 27.9858 41.6741 27.5091 41.3448 27.2678Z',
    delayMs: 450
  }
] as const

const DRAW_DURATION_MS = 680
const HOVER_DRAW_DURATION_MS = 400
const PERIODIC_INTERVAL_MS = 10_000
const STAGGER_END_MS = LOGO_PARTS[LOGO_PARTS.length - 1].delayMs
const INTRO_TOTAL_MS = STAGGER_END_MS + DRAW_DURATION_MS + 80
const HOVER_TOTAL_MS = STAGGER_END_MS + HOVER_DRAW_DURATION_MS + 60

type DrawMode = 'intro' | 'hover'

interface AidHoverLogoProps {
  alt?: string
  className?: string
}

export default function AidHoverLogo({ alt = 'AID', className }: AidHoverLogoProps) {
  const [isDrawing, setIsDrawing] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [drawMode, setDrawMode] = useState<DrawMode>('intro')
  const [drawCycle, setDrawCycle] = useState(0)

  // 逻辑判断用镜像 ref，避免 interval / timeout 闭包读到过期 state
  const reducedRef = useRef(false)
  const introFinishedRef = useRef(false)
  const isDrawingRef = useRef(false)
  const drawModeRef = useRef<DrawMode>('intro')
  const hoverCooldownRef = useRef(false)
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const periodicTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function clearCompleteTimer() {
    if (completeTimerRef.current) {
      clearTimeout(completeTimerRef.current)
      completeTimerRef.current = null
    }
  }

  function clearPeriodicTimer() {
    if (periodicTimerRef.current) {
      clearInterval(periodicTimerRef.current)
      periodicTimerRef.current = null
    }
  }

  function finishDraw(totalMs: number) {
    clearCompleteTimer()
    const mode = drawModeRef.current
    completeTimerRef.current = setTimeout(() => {
      isDrawingRef.current = false
      setIsDrawing(false)
      setIsComplete(true)
      introFinishedRef.current = true
      completeTimerRef.current = null

      if (mode === 'intro') {
        startPeriodicDraw()
      }
    }, totalMs)
  }

  function playDraw(mode: DrawMode) {
    if (reducedRef.current) {
      setIsComplete(true)
      introFinishedRef.current = true
      return
    }

    drawModeRef.current = mode
    setDrawMode(mode)
    setDrawCycle((c) => c + 1)
    isDrawingRef.current = false
    setIsDrawing(false)
    setIsComplete(false)

    requestAnimationFrame(() => {
      isDrawingRef.current = true
      setIsDrawing(true)
      finishDraw(mode === 'intro' ? INTRO_TOTAL_MS : HOVER_TOTAL_MS)
    })
  }

  function triggerReplayDraw() {
    if (reducedRef.current) return
    if (!introFinishedRef.current) return
    if (isDrawingRef.current) return
    if (hoverCooldownRef.current) return

    hoverCooldownRef.current = true
    playDraw('hover')
    window.setTimeout(() => {
      hoverCooldownRef.current = false
    }, HOVER_TOTAL_MS)
  }

  function startPeriodicDraw() {
    clearPeriodicTimer()
    periodicTimerRef.current = setInterval(triggerReplayDraw, PERIODIC_INTERVAL_MS)
  }

  function onPointerEnter() {
    triggerReplayDraw()
  }

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    reducedRef.current = reduced
    setPrefersReducedMotion(reduced)

    if (reduced) {
      setIsComplete(true)
      introFinishedRef.current = true
    } else {
      playDraw('intro')
    }

    return () => {
      clearCompleteTimer()
      clearPeriodicTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const groupClass = [
    'aid-hover-logo__group',
    isDrawing ? 'is-drawing' : '',
    isComplete ? 'is-complete' : '',
    prefersReducedMotion ? 'is-reduced' : '',
    drawMode === 'hover' ? 'is-hover-draw' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span
      className={className ? `aid-hover-logo ${className}` : 'aid-hover-logo'}
      role="img"
      aria-label={alt}
      onMouseEnter={onPointerEnter}
      onFocus={onPointerEnter}
    >
      <svg
        className="aid-hover-logo__svg"
        viewBox="0 0 56 56"
        width="56"
        height="56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g className={groupClass}>
          {LOGO_PARTS.map((part) => (
            <path
              id={part.id}
              key={`${part.id}-${drawCycle}`}
              className="aid-hover-logo__path"
              d={part.d}
              pathLength={1}
              style={{ '--draw-delay': `${part.delayMs}ms` } as CSSProperties}
            />
          ))}
        </g>
      </svg>
    </span>
  )
}
