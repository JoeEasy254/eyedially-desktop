import { useState } from 'react'
import { Copy, Download, FolderOpen, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import type { ProjectSummary } from '@shared/types'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function ProjectLibrary({
  projects,
  currentId,
  loading,
  onClose,
  onOpen,
  onNew,
  onImport,
  onDelete,
  onDuplicate,
  onRename,
  onExportCurrent,
  onOpenFolder,
}: {
  projects: ProjectSummary[]
  currentId: string | null
  loading: boolean
  onClose: () => void
  onOpen: (id: string) => void
  onNew: () => void
  onImport: () => void
  onDelete: (id: string) => Promise<void>
  onDuplicate: (id: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onExportCurrent: () => void
  onOpenFolder: () => void
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(id: string, action: () => Promise<void>) {
    setBusyId(id)
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusyId(null)
    }
  }

  function commitRename(id: string) {
    const name = renameValue.trim()
    if (!name) {
      setRenamingId(null)
      return
    }
    void run(id, async () => {
      await onRename(id, name)
      setRenamingId(null)
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal library-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Project library</h2>
          <button className="modal-close" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="library-toolbar">
          <button className="btn-primary" onClick={onNew}>
            <Plus size={15} />
            New project
          </button>
          <button className="library-btn" onClick={onImport}>
            <Upload size={15} />
            Import
          </button>
          <button className="library-btn" onClick={onOpenFolder}>
            <FolderOpen size={15} />
            Projects folder
          </button>
          {currentId && (
            <button className="library-btn" onClick={onExportCurrent}>
              <Download size={15} />
              Export current
            </button>
          )}
        </div>

        {error && <div className="library-error">{error}</div>}

        <div className="library-list">
          {loading && <div className="library-empty">Loading projects…</div>}
          {!loading && projects.length === 0 && (
            <div className="library-empty">No projects yet. Create one to get started.</div>
          )}
          {projects.map((project) => (
            <div
              key={project.id}
              className={`library-row${project.id === currentId ? ' library-row-current' : ''}`}
            >
              <div className="library-row-main">
                {renamingId === project.id ? (
                  <input
                    className="library-rename-input"
                    value={renameValue}
                    autoFocus
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitRename(project.id)
                      if (event.key === 'Escape') setRenamingId(null)
                    }}
                    onBlur={() => commitRename(project.id)}
                  />
                ) : (
                  <button className="library-open" onClick={() => onOpen(project.id)}>
                    <span className="library-name">
                      {project.name}
                      {project.id === currentId && <span className="library-current-badge">open</span>}
                    </span>
                    <span className="library-meta">
                      {project.fileCount} file{project.fileCount === 1 ? '' : 's'} · Updated{' '}
                      {formatDate(project.updatedAt)}
                    </span>
                  </button>
                )}
              </div>

              <div className="library-row-actions">
                <button
                  className="library-icon-btn"
                  title="Rename"
                  disabled={busyId === project.id}
                  onClick={() => {
                    setRenamingId(project.id)
                    setRenameValue(project.name)
                    setConfirmDeleteId(null)
                  }}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="library-icon-btn"
                  title="Duplicate"
                  disabled={busyId === project.id}
                  onClick={() => void run(project.id, () => onDuplicate(project.id))}
                >
                  <Copy size={15} />
                </button>
                {confirmDeleteId === project.id ? (
                  <button
                    className="library-icon-btn library-danger"
                    title="Confirm delete"
                    disabled={busyId === project.id}
                    onClick={() =>
                      void run(project.id, async () => {
                        await onDelete(project.id)
                        setConfirmDeleteId(null)
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                ) : (
                  <button
                    className="library-icon-btn"
                    title="Delete"
                    onClick={() => setConfirmDeleteId(project.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="library-footer">
          Autosave is on. Projects are stored as plain JSON in your app data folder.
        </div>
      </div>
    </div>
  )
}
