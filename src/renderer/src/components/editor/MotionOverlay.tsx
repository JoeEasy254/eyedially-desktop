import { useEffect, useRef } from 'react'
import type { MotionArrow } from '../../lib/analyzer'

export default function MotionOverlay({
  arrowsRef,
  enabled,
}: {
  arrowsRef: { current: MotionArrow[] }
  enabled: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled) return
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    const ctx = canvas.getContext('2d')!
    let raf: number

    function resize() {
      const rect = wrap.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, rect.width * dpr)
      canvas.height = Math.max(1, rect.height * dpr)
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const v of arrowsRef.current) {
        drawArrow(ctx, v)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [enabled, arrowsRef])

  if (!enabled) return null

  return (
    <div ref={wrapRef} className="viz-overlay viz-overlay-vectors" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}

function drawArrow(ctx: CanvasRenderingContext2D, v: MotionArrow) {
  const ox = v.ox
  const oy = v.oy
  const tx = ox + v.x
  const ty = oy + v.y
  const len = Math.hypot(v.x, v.y)
  if (len < 1) return
  const angle = Math.atan2(v.y, v.x)
  const headLen = Math.min(10, len * 0.3)

  ctx.save()
  ctx.strokeStyle = v.color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(ox, oy)
  ctx.lineTo(tx, ty)
  ctx.stroke()

  ctx.fillStyle = v.color
  ctx.beginPath()
  ctx.moveTo(tx, ty)
  ctx.lineTo(tx - headLen * Math.cos(angle - 0.4), ty - headLen * Math.sin(angle - 0.4))
  ctx.lineTo(tx - headLen * Math.cos(angle + 0.4), ty - headLen * Math.sin(angle + 0.4))
  ctx.closePath()
  ctx.fill()

  if (v.label) {
    ctx.fillStyle = v.color
    ctx.font = '10px monospace'
    ctx.fillText(v.label, tx + 7, ty - 7)
  }
  ctx.restore()
}
