import { useState } from 'react'
import { X } from 'lucide-react'
import { EXAMPLES } from '../lib/starter'

export default function NewProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (name: string, template: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [template, setTemplate] = useState('blank')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = EXAMPLES.find((example) => example.id === template)

  async function submit() {
    const finalName = name.trim() || selected?.title || 'Untitled simulation'
    setBusy(true)
    setError(null)
    try {
      await onCreate(finalName, template)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal new-project-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>New particles project</h2>
          <button className="modal-close" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="new-project-body">
          <label className="new-project-label" htmlFor="project-name">
            Project name
          </label>
          <input
            id="project-name"
            className="new-project-input"
            value={name}
            autoFocus
            placeholder={selected?.title ?? 'Untitled simulation'}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !busy) void submit()
            }}
          />

          <div className="new-project-label">Start from</div>
          <div className="template-grid">
            <button
              className={`template-card${template === 'blank' ? ' template-card-active' : ''}`}
              onClick={() => setTemplate('blank')}
            >
              <span className="template-title">Blank starter</span>
              <span className="template-copy">A single bouncing particle to build on.</span>
            </button>
            {EXAMPLES.map((example) => (
              <button
                key={example.id}
                className={`template-card${template === example.id ? ' template-card-active' : ''}`}
                onClick={() => setTemplate(example.id)}
              >
                <span className="template-title">{example.title}</span>
                <span className="template-copy">{example.description}</span>
              </button>
            ))}
          </div>

          {error && <div className="library-error">{error}</div>}
        </div>

        <div className="modal-footer new-project-footer">
          <button className="library-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  )
}
