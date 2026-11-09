import type { FrameResult } from '../types/FrameResult'

export function parseNumber(value: string | number): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const match = value.trim().match(/^[+-]?\d*\.?\d+(?:[eE][+-]?\d+)?/)
  return match ? parseFloat(match[0]) : null
}

const MAX_SAMPLES = 600
const MAX_PLOT_POINTS = 120

export interface Sample {
  t: number
  values: Record<string, number>
}

export interface SeriesPoint {
  t: number
  v: number
}

export class SampleRecorder {
  private buffer: Sample[] = []
  private offset = 0
  private count = 0
  private cap: number

  constructor(cap: number = MAX_SAMPLES) {
    this.cap = cap
  }

  push(t: number, values: Record<string, number>) {
    if (Object.keys(values).length === 0) return
    const buf = this.buffer
    const idx = this.offset
    if (this.count < this.cap) {
      buf.push({ t, values })
      this.count++
    } else {
      buf[idx] = { t, values }
    }
    this.offset = (this.offset + 1) % this.cap
  }

  keys(): string[] {
    const seen = new Set<string>()
    for (let i = 0; i < this.count; i++) {
      const sample = this.buffer[(this.offset - this.count + i + this.cap * 2) % this.cap]
      for (const k of Object.keys(sample.values)) seen.add(k)
    }
    return Array.from(seen).sort()
  }

  series(key: string): SeriesPoint[] {
    const out: SeriesPoint[] = []
    for (let i = 0; i < this.count; i++) {
      const sample = this.buffer[(this.offset - this.count + i + this.cap * 2) % this.cap]
      const v = sample.values[key]
      if (v !== undefined) out.push({ t: sample.t, v })
    }
    return out
  }

  downsampled(key: string): SeriesPoint[] {
    const raw = this.series(key)
    if (raw.length <= MAX_PLOT_POINTS) return raw
    const step = raw.length / MAX_PLOT_POINTS
    const out: SeriesPoint[] = []
    for (let i = 0; i < MAX_PLOT_POINTS; i++) {
      const start = Math.floor(i * step)
      const end = Math.min(raw.length, Math.floor((i + 1) * step))
      let sum = 0
      for (let j = start; j < end; j++) sum += raw[j].v
      out.push({ t: raw[start].t, v: sum / (end - start) })
    }
    return out
  }

  bounds(key: string): { min: number; max: number; latest: number | null } {
    let min = Infinity
    let max = -Infinity
    let latest: number | null = null
    for (let i = 0; i < this.count; i++) {
      const sample = this.buffer[(this.offset - this.count + i + this.cap * 2) % this.cap]
      const v = sample.values[key]
      if (v === undefined) continue
      if (v < min) min = v
      if (v > max) max = v
      latest = v
    }
    if (min === Infinity) return { min: 0, max: 1, latest: null }
    if (min === max) {
      min -= 1
      max += 1
    }
    return { min, max, latest }
  }

  reset() {
    this.buffer = []
    this.offset = 0
    this.count = 0
  }
}

interface TrackedPoint {
  x: number
  y: number
}

export interface MotionArrow {
  ox: number
  oy: number
  x: number
  y: number
  color: string
  label: string
}

const VECTOR_MAX_LEN = 60
const VECTOR_SCALE = 0.35

export class MotionTracker {
  private prev = new Map<number, TrackedPoint>()
  private prevVel = new Map<number, { vx: number; vy: number }>()
  private colors = ['#22C55E', '#F59E0B', '#3B82F6', '#EF4444', '#22D3EE', '#A78BFA']

  reset() {
    this.prev.clear()
    this.prevVel.clear()
  }

  update(
    result: FrameResult | null,
    dt: number,
    opts: { speed?: boolean }
  ): MotionArrow[] {
    if (!result || dt <= 0) return []
    const points: TrackedPoint[] = []
    result.particles?.forEach((p) => points.push({ x: p.x, y: p.y }))

    const arrows: MotionArrow[] = []
    const nextPrev = new Map<number, TrackedPoint>()
    const nextVel = new Map<number, { vx: number; vy: number }>()

    let colorIdx = 0
    for (let i = 0; i < points.length; i++) {
      const cur = points[i]
      const prevPt = this.prev.get(i)
      const prevV = this.prevVel.get(i)
      if (prevPt) {
        const vx = (cur.x - prevPt.x) / dt
        const vy = (cur.y - prevPt.y) / dt
        const smooth = prevV ? { vx: prevV.vx * 0.6 + vx * 0.4, vy: prevV.vy * 0.6 + vy * 0.4 } : { vx, vy }
        let px = smooth.vx * VECTOR_SCALE
        let py = smooth.vy * VECTOR_SCALE
        const mag = Math.hypot(px, py)
        if (mag > VECTOR_MAX_LEN) {
          px = (px / mag) * VECTOR_MAX_LEN
          py = (py / mag) * VECTOR_MAX_LEN
        }
        const color = this.colors[colorIdx % this.colors.length]
        const label = opts.speed ? `${(Math.hypot(smooth.vx, smooth.vy)).toFixed(0)}px/s` : ''
        arrows.push({ ox: cur.x, oy: cur.y, x: px, y: py, color, label })
        nextVel.set(i, smooth)
        colorIdx++
      }
      nextPrev.set(i, cur)
    }

    this.prev = nextPrev
    this.prevVel = nextVel
    return arrows
  }
}
