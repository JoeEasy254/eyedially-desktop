import { useEffect, useState } from 'react'
import type { SampleRecorder } from '../../lib/analyzer'

const CHART_W = 240
const CHART_H = 44

export default function ValueGraphs({
  recorder,
  enabledKeys,
  onToggleKey,
}: {
  recorder: SampleRecorder
  enabledKeys: Set<string>
  onToggleKey: (key: string) => void
}) {
  const [, setTick] = useState(0)
  const keys = recorder.keys()

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 200)
    return () => clearInterval(id)
  }, [])

  const visible = keys.filter((k) => enabledKeys.has(k))

  if (visible.length === 0) {
    return (
      <div className="graph-panel">
        <div className="graph-panel-empty">
          No numeric values to plot yet. Add numbers to your HUD (e.g. <code>text: &#123; energy &#125;</code>) while
          the sim runs.
        </div>
      </div>
    )
  }

  return (
    <div className="graph-panel">
      {visible.map((key) => {
        const series = recorder.downsampled(key)
        const { min, max, latest } = recorder.bounds(key)
        const span = max - min || 1
        const pts = series
          .map((p, i) => {
            const x = (i / Math.max(1, series.length - 1)) * CHART_W
            const y = CHART_H - ((p.v - min) / span) * CHART_H
            return `${x.toFixed(1)},${y.toFixed(1)}`
          })
          .join(' ')
        const latestLabel = latest !== null ? formatValue(latest) : '—'
        return (
          <div className="graph-row" key={key}>
            <button className="graph-key" onClick={() => onToggleKey(key)} title="Click to hide this graph">
              <span className="graph-key-name">{key}</span>
              <span className="graph-key-latest">{latestLabel}</span>
            </button>
            <svg
              className="graph-svg"
              width={CHART_W}
              height={CHART_H}
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              aria-hidden="true"
            >
              <line className="graph-grid" x1={0} y1={CHART_H / 2} x2={CHART_W} y2={CHART_H / 2} />
              {pts && <polyline className="graph-line" points={pts} fill="none" />}
            </svg>
          </div>
        )
      })}
      <div className="graph-panel-chips">
        {keys
          .filter((k) => !enabledKeys.has(k))
          .map((k) => (
            <button className="graph-chip" key={k} onClick={() => onToggleKey(k)}>
              + {k}
            </button>
          ))}
      </div>
    </div>
  )
}

function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(2)
}
