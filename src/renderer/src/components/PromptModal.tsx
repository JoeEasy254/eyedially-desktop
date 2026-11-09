import { useState } from 'react'
import { X } from 'lucide-react'

export default function PromptModal({
  title,
  label,
  initialValue,
  submitLabel,
  onClose,
  onSubmit,
}: {
  title: string
  label: string
  initialValue: string
  submitLabel: string
  onClose: () => void
  onSubmit: (value: string) => Promise<void>
}) {
  const [value, setValue] = useState(initialValue)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!value.trim()) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(value.trim())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal prompt-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>
        <div className="prompt-body">
          <label className="new-project-label" htmlFor="prompt-value">
            {label}
          </label>
          <input
            id="prompt-value"
            className="new-project-input"
            value={value}
            autoFocus
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !busy) void submit()
              if (event.key === 'Escape') onClose()
            }}
          />
          {error && <div className="library-error">{error}</div>}
        </div>
        <div className="modal-footer new-project-footer">
          <button className="library-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => void submit()} disabled={busy || !value.trim()}>
            {busy ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
