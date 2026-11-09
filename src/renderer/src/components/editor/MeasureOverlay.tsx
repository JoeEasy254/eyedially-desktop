import { useCallback, useEffect, useRef } from 'react'

interface Pt {
  x: number
  y: number
}

export default function MeasureOverlay({ enabled }: { enabled: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef<Pt | null>(null)
  const aRef = useRef<Pt | null>(null)
  const bRef = useRef<Pt | null>(null)

  const resize = useCallback(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const rect = wrap.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, rect.width * dpr)
    canvas.height = Math.max(1, rect.height * dpr)
    canvas.style.width = rect.width + 'px'
    canvas.style.height = rect.height + 'px'
    canvas.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [])

  const clear = useCallback(() => {
    aRef.current = null
    bRef.current = null
  }, [])

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clear()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, clear])

  useEffect(() => {
    if (!enabled) return
    resize()
    const wrap = wrapRef.current!
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf: number

    const loop = () => {
      const rect = wrap.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)
      const a = aRef.current
      const b = bRef.current
      const cursor = cursorRef.current

      if (a) {
        const end = b ?? cursor
        if (end) {
          drawMeasurement(ctx, a, end, b ? 'pinned' : 'live')
        }
      }
      if (cursor) drawCrosshair(ctx, cursor, rect.width, rect.height)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [enabled, resize])

  if (!enabled) return null

  const localPos = (e: React.PointerEvent): Pt => {
    const rect = wrapRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  return (
    <div
      ref={wrapRef}
      className="viz-overlay viz-overlay-measure"
      onPointerMove={(e) => {
        cursorRef.current = localPos(e)
      }}
      onPointerLeave={() => {
        cursorRef.current = null
      }}
      onPointerDown={(e) => {
        if (e.button === 2) {
          clear()
          return
        }
        const p = localPos(e)
        if (!aRef.current) {
          aRef.current = p
          bRef.current = null
        } else if (!bRef.current) {
          bRef.current = p
        } else {
          aRef.current = p
          bRef.current = null
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} />
    </div>
  )
}

function drawCrosshair(ctx: CanvasRenderingContext2D, p: Pt, w: number, _h: number) {
  const s = 7
  ctx.save()
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(p.x - s, p.y)
  ctx.lineTo(p.x + s, p.y)
  ctx.moveTo(p.x, p.y - s)
  ctx.lineTo(p.x, p.y + s)
  ctx.stroke()

  const label = `(${Math.round(p.x)}, ${Math.round(p.y)})`
  ctx.font = '11px monospace'
  const tw = ctx.measureText(label).width
  let lx = p.x + 10
  let ly = p.y - 10
  if (lx + tw > w) lx = p.x - tw - 10
  if (ly - 12 < 0) ly = p.y + 20
  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.fillRect(lx - 3, ly - 11, tw + 6, 16)
  ctx.fillStyle = '#F59E0B'
  ctx.fillText(label, lx, ly)
  ctx.restore()
}

function drawMeasurement(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, kind: 'live' | 'pinned') {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist = Math.hypot(dx, dy)
  const midX = (a.x + b.x) / 2
  const midY = (a.y + b.y) / 2

  ctx.save()
  ctx.strokeStyle = kind === 'pinned' ? 'rgba(34, 197, 94, 0.95)' : 'rgba(245, 158, 11, 0.9)'
  ctx.setLineDash(kind === 'live' ? [6, 4] : [])
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()

  ctx.setLineDash([])
  for (const p of [a, b]) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
    ctx.fillStyle = ctx.strokeStyle as string
    ctx.fill()
  }

  const label = `${dist.toFixed(0)}px  (dx ${dx.toFixed(0)}, dy ${dy.toFixed(0)})`
  ctx.font = '11px monospace'
  const tw = ctx.measureText(label).width
  ctx.fillStyle = 'rgba(0,0,0,0.75)'
  ctx.fillRect(midX - tw / 2 - 3, midY - 9, tw + 6, 16)
  ctx.fillStyle = kind === 'pinned' ? '#22C55E' : '#F59E0B'
  ctx.fillText(label, midX - tw / 2, midY + 3)
  ctx.restore()
}
