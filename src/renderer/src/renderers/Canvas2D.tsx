import { useRef, useEffect, useCallback } from 'react'
import type { FrameResult } from '../types/FrameResult'
import { drawFrame, drawFrameLabels, paintBackground } from './canvasUtils'

export default function Canvas2D({
  frame,
  paused,
  onClickCanvas,
  error,
  focusedRef,
  speed = 1,
  stepKey = 0,
  onResult,
  onPointerMove,
  onPointerLeave,
  containerRef: externalContainerRef,
  canvasRef: externalCanvasRef,
}: {
  frame: (time: number, dt: number, w: number, h: number) => FrameResult | null
  paused: boolean
  onClickCanvas?: (x: number, y: number) => void
  error?: string | null
  focusedRef?: { current: boolean }
  speed?: number
  stepKey?: number
  onResult?: (result: FrameResult | null, dt: number) => void
  onPointerMove?: (x: number, y: number) => void
  onPointerLeave?: () => void
  containerRef?: React.RefObject<HTMLDivElement | null>
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const internalContainerRef = useRef<HTMLDivElement>(null)
  const containerRef = externalContainerRef ?? internalContainerRef
  const prevTime = useRef(0)
  const pausedRef = useRef(paused)
  const speedRef = useRef(speed)
  const stepKeyRef = useRef(stepKey)
  const lastStepKeyRef = useRef(stepKey)
  const lastFrameRef = useRef<FrameResult | null>(null)
  const onResultRef = useRef(onResult)
  const onPointerMoveRef = useRef(onPointerMove)
  const onPointerLeaveRef = useRef(onPointerLeave)
  const frameRef = useRef(frame)

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    stepKeyRef.current = stepKey
  }, [stepKey])

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  useEffect(() => {
    onPointerMoveRef.current = onPointerMove
  }, [onPointerMove])

  useEffect(() => {
    onPointerLeaveRef.current = onPointerLeave
  }, [onPointerLeave])

  useEffect(() => {
    frameRef.current = frame
  }, [frame])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      canvasRef.current?.focus()
      if (focusedRef) focusedRef.current = true
      if (!onClickCanvas || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      onClickCanvas(e.clientX - rect.left, e.clientY - rect.top)
    },
    [onClickCanvas, focusedRef, containerRef]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!containerRef.current || !onPointerMoveRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      onPointerMoveRef.current(e.clientX - rect.left, e.clientY - rect.top)
    },
    [containerRef]
  )

  const handleCanvasFocus = useCallback(() => {
    if (focusedRef) focusedRef.current = true
  }, [focusedRef])

  const handleCanvasBlur = useCallback(() => {
    if (focusedRef) focusedRef.current = false
  }, [focusedRef])

  useEffect(() => {
    const canvas = canvasRef.current!
    const overlayCanvas = overlayCanvasRef.current!
    const container = containerRef.current!
    const ctx = canvas.getContext('2d')!
    const overlayCtx = overlayCanvas.getContext('2d')!
    let raf: number

    function resize() {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      overlayCanvas.width = rect.width * dpr
      overlayCanvas.height = rect.height * dpr
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
      overlayCanvas.style.width = rect.width + 'px'
      overlayCanvas.style.height = rect.height + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    const loop = (timestamp: number) => {
      if (!prevTime.current) prevTime.current = timestamp
      const dt = Math.min((timestamp - prevTime.current) / 1000, 0.05)
      prevTime.current = timestamp

      const rect = container.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      overlayCtx.clearRect(0, 0, w, h)

      paintBackground(ctx, w, h)

      const stepping = stepKeyRef.current !== lastStepKeyRef.current
      if (stepping) lastStepKeyRef.current = stepKeyRef.current

      let result: FrameResult | null = null
      let effDt = 0
      if (stepping) {
        effDt = 1 / 60
        result = frameRef.current(0, effDt, w, h)
        if (result) {
          lastFrameRef.current = result
          drawFrame(ctx, result, w, h, { drawLabels: false })
          drawFrameLabels(overlayCtx, result, w, h)
        }
      } else if (!pausedRef.current) {
        effDt = dt * speedRef.current
        result = frameRef.current(0, effDt, w, h)
        if (result) {
          lastFrameRef.current = result
          drawFrame(ctx, result, w, h, { drawLabels: false })
          drawFrameLabels(overlayCtx, result, w, h)
        }
      } else if (lastFrameRef.current) {
        drawFrame(ctx, lastFrameRef.current, w, h, { drawLabels: false })
        drawFrameLabels(overlayCtx, lastFrameRef.current, w, h)
      }

      if (result) onResultRef.current?.(result, effDt)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [containerRef])

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      onMouseDown={handleMouseDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => onPointerLeaveRef.current?.()}
    >
      <canvas
        ref={(node) => {
          canvasRef.current = node
          if (externalCanvasRef) externalCanvasRef.current = node
        }}
        tabIndex={-1}
        onFocus={handleCanvasFocus}
        onBlur={handleCanvasBlur}
      />
      <canvas ref={overlayCanvasRef} className="canvas-overlay" aria-hidden="true" />
      {error && (
        <div className="canvas-error-bar">
          <p className="canvas-error-text">{error}</p>
        </div>
      )}
    </div>
  )
}
