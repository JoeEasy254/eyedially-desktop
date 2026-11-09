import type { FrameResult } from '../types/FrameResult'

function resolveColor(input: string | undefined | null, fallback: string): string {
  return input ?? fallback
}

/** Legibility floor: dots authored below ~1px or nearly transparent vanish
 * entirely. Nudge them into visibility; r=0 stays hidden (explicit hide). */
function legibleRadius(r: number | undefined, fallback: number): number {
  const v = r ?? fallback
  if (v === 0) return 0
  return Math.max(v, 1.5)
}

/** Lift near-zero alpha so faint dots leave at least a ghost. Opaque colors
 * pass through untouched. */
function liftAlpha(color: string, floor: number): string {
  const m = color.match(/^(rgba?\(.*,\s*)([0-9.]+)(\s*\))$/)
  if (m && Number(m[2]) < floor) return `${m[1]}${floor}${m[3]}`
  const h = color.match(/^(hsla?\(.*,\s*)([0-9.]+)(%?\s*\))$/)
  if (h && Number(h[2]) < floor) return `${h[1]}${floor}${h[3]}`
  return color
}

/** White label with a dark halo so it survives any background. */
function haloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string) {
  ctx.save()
  ctx.font = font
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0,0,0,0.75)'
  ctx.strokeText(text, x, y)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, x, y)
  ctx.restore()
}

export function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h)
}

export function drawAxes(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 1

  ctx.beginPath()
  ctx.moveTo(cx - size, cy)
  ctx.lineTo(cx + size, cy)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(cx, cy - size)
  ctx.lineTo(cx, cy + size)
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.font = '10px monospace'
  ctx.fillText('x', cx + size + 4, cy + 3)
  ctx.fillText('y', cx + 4, cy - size - 4)
  ctx.restore()
}

export function drawTextHud(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: Record<string, string | number>,
) {
  const entries = Object.entries(text)
  if (!entries.length) return

  const padding = 10
  const lineHeight = 16
  const font = '12px monospace'
  const maxBoxWidth = Math.min(340, Math.max(160, w * 0.5))
  const naturalWidth = entries.reduce((width, [key, value]) => {
    ctx.font = font
    return Math.max(width, ctx.measureText(`${key}: ${String(value ?? '')}`).width)
  }, 0)
  const boxWidth = Math.min(w - 10, Math.max(160, Math.min(maxBoxWidth, naturalWidth + padding * 2)))
  const contentWidth = Math.max(1, boxWidth - padding * 2)
  const lines: string[] = []

  for (const [key, value] of entries) {
    const words = `${key}: ${String(value ?? '')}`.split(/\s+/)
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width <= contentWidth) {
        line = candidate
        continue
      }
      if (line) lines.push(line)
      line = ''
      for (const character of word) {
        const characterCandidate = line + character
        if (ctx.measureText(characterCandidate).width > contentWidth && line) {
          lines.push(line)
          line = character
        } else {
          line = characterCandidate
        }
      }
    }
    if (line) lines.push(line)
  }

  const boxHeight = lines.length * lineHeight + padding * 2
  const boxX = Math.max(5, w - boxWidth - 5)
  const boxY = 5
  ctx.save()
  ctx.font = font
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') ctx.roundRect(boxX, boxY, boxWidth, Math.min(boxHeight, h - 10), 7)
  else {
    ctx.moveTo(boxX + 7, boxY)
    ctx.arcTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + 7, 7)
    ctx.arcTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - 7, boxY + boxHeight, 7)
    ctx.arcTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - 7, 7)
    ctx.arcTo(boxX, boxY, boxX + 7, boxY, 7)
    ctx.closePath()
  }
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  let y = boxY + padding + 11
  for (const line of lines) {
    ctx.fillText(line, boxX + padding, y)
    y += lineHeight
  }
  ctx.restore()
}

export function drawFrameLabels(
  ctx: CanvasRenderingContext2D,
  result: FrameResult,
  w: number,
  h: number,
) {
  for (const bar of result.bars ?? []) {
    if (!bar.label) continue
    haloText(ctx, bar.label, bar.x, bar.y - 5, '12px monospace')
  }

  for (const vector of result.vectors ?? []) {
    if (!vector.label) continue
    const ox = vector.ox ?? 0
    const oy = vector.oy ?? 0
    haloText(ctx, vector.label, ox + vector.x + 8, oy + vector.y - 8, '11px monospace')
  }

  for (const particle of result.particles ?? []) {
    if (!particle.label) continue
    const r = particle.r ?? 6
    haloText(ctx, particle.label, particle.x + r + 5, particle.y + 4, '11px monospace')
  }

  if (result.text) drawTextHud(ctx, w, h, result.text)
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  result: FrameResult,
  w: number,
  _h: number,
  options?: { drawLabels?: boolean },
) {
  if (result.lines?.length) {
    const groups = new Map<string, { color: string; width: number; dashed: boolean; items: typeof result.lines }>()
    for (const line of result.lines) {
      const color = resolveColor(line.color, '#ffffff')
      const width = Math.max(line.width ?? 2, 1)
      const dashed = Boolean(line.dashed)
      const key = `${color}|${width}|${dashed}`
      let group = groups.get(key)
      if (!group) {
        group = { color, width, dashed, items: [] }
        groups.set(key, group)
      }
      group.items.push(line)
    }
    for (const group of groups.values()) {
      ctx.save()
      ctx.beginPath()
      ctx.strokeStyle = group.color
      ctx.lineWidth = group.width
      if (group.dashed) ctx.setLineDash([6, 4])
      for (const line of group.items) {
        ctx.moveTo(line.x1, line.y1)
        ctx.lineTo(line.x2, line.y2)
      }
      ctx.stroke()
      ctx.restore()
    }
  }

  if (result.circles?.length) {
    const groups = new Map<string, { fill: string | null; stroke: string; items: typeof result.circles }>()
    for (const circle of result.circles) {
      const fill = circle.fill ? resolveColor(circle.fill, 'rgba(255,255,255,0.2)') : null
      const stroke = resolveColor(circle.color, 'rgba(255,255,255,0.2)')
      const key = `${fill ?? ''}|${stroke}`
      let group = groups.get(key)
      if (!group) {
        group = { fill, stroke, items: [] }
        groups.set(key, group)
      }
      group.items.push(circle)
    }
    for (const group of groups.values()) {
      ctx.save()
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (const circle of group.items) {
        // Start each circle as its own subpath. Without this moveTo, Canvas
        // connects the previous circle's endpoint to the next circle.
        ctx.moveTo(circle.cx + circle.r, circle.cy)
        ctx.arc(circle.cx, circle.cy, circle.r, 0, Math.PI * 2)
      }
      if (group.fill) {
        ctx.fillStyle = group.fill
        ctx.fill()
      }
      ctx.shadowBlur = 0
      ctx.strokeStyle = group.stroke
      ctx.stroke()
      ctx.restore()
    }
  }

  if (result.arcs?.length) {
    const groups = new Map<string, { color: string; width: number; items: typeof result.arcs }>()
    for (const arc of result.arcs) {
      const color = resolveColor(arc.color, '#F59E0B')
      const width = arc.width ?? 2
      const key = `${color}|${width}`
      let group = groups.get(key)
      if (!group) {
        group = { color, width, items: [] }
        groups.set(key, group)
      }
      group.items.push(arc)
    }
    for (const group of groups.values()) {
      ctx.save()
      ctx.beginPath()
      ctx.strokeStyle = group.color
      ctx.lineWidth = group.width
      for (const arc of group.items) {
        ctx.moveTo(
          arc.cx + Math.cos(arc.startAngle) * arc.r,
          arc.cy + Math.sin(arc.startAngle) * arc.r,
        )
        ctx.arc(arc.cx, arc.cy, arc.r, arc.startAngle, arc.endAngle)
      }
      ctx.stroke()
      ctx.restore()
    }
  }

  result.bars?.forEach((b) => {
    ctx.save()
    ctx.fillStyle = resolveColor(b.color, '#8B5CF6')
    ctx.fillRect(b.x, b.y, b.w, b.h)
    ctx.restore()
  })

  if (result.vectors?.length) {
    const groups = new Map<string, { color: string; items: typeof result.vectors }>()
    for (const vector of result.vectors) {
      const color = resolveColor(vector.color, '#22C55E')
      let group = groups.get(color)
      if (!group) {
        group = { color, items: [] }
        groups.set(color, group)
      }
      group.items.push(vector)
    }
    for (const group of groups.values()) {
      ctx.save()
      ctx.strokeStyle = group.color
      ctx.fillStyle = group.color
      ctx.lineWidth = 2
      ctx.beginPath()
      for (const vector of group.items) {
        const ox = vector.ox ?? 0
        const oy = vector.oy ?? 0
        ctx.moveTo(ox, oy)
        ctx.lineTo(ox + vector.x, oy + vector.y)
      }
      ctx.stroke()
      ctx.beginPath()
      for (const vector of group.items) {
        const ox = vector.ox ?? 0
        const oy = vector.oy ?? 0
        const angle = Math.atan2(vector.y, vector.x)
        const headLen = Math.max(3, Math.min(12, Math.hypot(vector.x, vector.y) * 0.3))
        ctx.moveTo(ox + vector.x, oy + vector.y)
        ctx.lineTo(ox + vector.x - headLen * Math.cos(angle - 0.4), oy + vector.y - headLen * Math.sin(angle - 0.4))
        ctx.lineTo(ox + vector.x - headLen * Math.cos(angle + 0.4), oy + vector.y - headLen * Math.sin(angle + 0.4))
        ctx.closePath()
      }
      ctx.fill()
      ctx.restore()
    }
  }

  if (result.particles?.length) {
    for (const p of result.particles) {
      const color = liftAlpha(resolveColor(p.color, '#8B5CF6'), 0.12)
      const r = legibleRadius(p.r, 6)
      if (r === 0) continue
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (options?.drawLabels !== false) drawFrameLabels(ctx, result, w, _h)
}
