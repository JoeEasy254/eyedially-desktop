const SPEED_LABELS: Record<number, string> = {
  0.25: '0.25\u00D7',
  0.5: '0.5\u00D7',
  1: '1\u00D7',
}

export default function VizToolbar({
  paused,
  speed,
  onStep,
  onCycleSpeed,
  graphsOn,
  onToggleGraphs,
  vectorsOn,
  onToggleVectors,
  measureOn,
  onToggleMeasure,
  onScreenshot,
  time,
  frame,
}: {
  paused: boolean
  speed: number
  onStep: () => void
  onCycleSpeed: () => void
  graphsOn: boolean
  onToggleGraphs: () => void
  vectorsOn: boolean
  onToggleVectors: () => void
  measureOn: boolean
  onToggleMeasure: () => void
  onScreenshot: () => void
  time: number
  frame: number
}) {
  return (
    <div className="viz-toolbar" role="toolbar" aria-label="Analysis tools">
      <div className="viz-toolbar-group">
        <button
          className={`viz-toolbar-btn${paused ? ' viz-toolbar-btn-accent' : ''}`}
          onClick={onStep}
          title="Step forward one frame (pauses the simulation)"
          aria-label="Step one frame"
        >
          {'\u23ED'}
        </button>
        <button
          className="viz-toolbar-btn viz-toolbar-speed"
          onClick={onCycleSpeed}
          title="Cycle playback speed"
          aria-label={`Playback speed ${SPEED_LABELS[speed]}`}
        >
          {SPEED_LABELS[speed]}
        </button>
        <span className="viz-toolbar-time">
          t&nbsp;=&nbsp;{time.toFixed(2)}s&nbsp;&middot;&nbsp;{frame}f
        </span>
      </div>
      <div className="viz-toolbar-group viz-toolbar-group-right">
        <button
          className={`viz-toolbar-btn viz-toolbar-btn-icon${graphsOn ? ' viz-toolbar-btn-active' : ''}`}
          onClick={onToggleGraphs}
          title="Toggle live value graphs (drawn from your HUD numbers)"
          aria-pressed={graphsOn}
          aria-label="Toggle value graphs"
        >
          {'\u{1F4C8}'}
        </button>
        <button
          className={`viz-toolbar-btn viz-toolbar-btn-icon${vectorsOn ? ' viz-toolbar-btn-active' : ''}`}
          onClick={onToggleVectors}
          title="Toggle velocity vectors (estimated from motion)"
          aria-pressed={vectorsOn}
          aria-label="Toggle velocity vectors"
        >
          {'\u2192'}
        </button>
        <button
          className={`viz-toolbar-btn viz-toolbar-btn-icon${measureOn ? ' viz-toolbar-btn-active' : ''}`}
          onClick={onToggleMeasure}
          title="Measure distances — click two points on the canvas"
          aria-pressed={measureOn}
          aria-label="Toggle measure tool"
        >
          {'\u{1F4CF}'}
        </button>
        <button
          className="viz-toolbar-btn viz-toolbar-btn-icon"
          onClick={onScreenshot}
          title="Download a PNG screenshot of the canvas"
          aria-label="Screenshot the canvas"
        >
          {'\u{1F4F7}'}
        </button>
      </div>
    </div>
  )
}
