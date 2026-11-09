import { useState, useRef, useEffect, useCallback } from 'react'
import type { ProjectFile } from '../types/ProjectFile'

const MIN_WIDTH = 160
const MAX_WIDTH = 520

export default function FileExplorer({
  files,
  activeFileId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onToggle,
}: {
  files: ProjectFile[]
  activeFileId: string
  onSelect: (id: string) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onToggle: () => void
}) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [width, setWidth] = useState(210)
  const [dragging, setDragging] = useState(false)
  const createRef = useRef<HTMLInputElement>(null)
  const renameRef = useRef<HTMLInputElement>(null)
  const explorerRef = useRef<HTMLDivElement>(null)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(210)

  useEffect(() => {
    if (creating) createRef.current?.focus()
  }, [creating])

  useEffect(() => {
    if (renamingId) renameRef.current?.focus()
  }, [renamingId])

  const widthLoaded = useRef(false)
  useEffect(() => {
    if (!widthLoaded.current) {
      widthLoaded.current = true
      const raw = localStorage.getItem('angaza-file-explorer-width')
      if (raw !== null) {
        const saved = Number(raw)
        if (!Number.isNaN(saved)) setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, saved)))
      }
      return
    }
    localStorage.setItem('angaza-file-explorer-width', String(width))
  }, [width])

  useEffect(() => {
    if (!creating) return
    function handleMouseDown(event: MouseEvent) {
      if (explorerRef.current && !explorerRef.current.contains(event.target as Node)) {
        setCreating(false)
        setNewName('')
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [creating])

  const handleResizeStart = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      dragStartX.current = event.clientX
      dragStartWidth.current = width
      setDragging(true)
    },
    [width]
  )

  useEffect(() => {
    if (!dragging) return

    function onMouseMove(event: MouseEvent) {
      const delta = event.clientX - dragStartX.current
      const next = Math.round(dragStartWidth.current + delta)
      const parent = explorerRef.current?.parentElement
      const max = parent ? Math.min(MAX_WIDTH, parent.clientWidth - 320) : MAX_WIDTH
      setWidth(Math.max(MIN_WIDTH, Math.min(max, next)))
    }

    function onMouseUp() {
      setDragging(false)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging])

  function confirmCreate() {
    const name = newName.trim()
    if (!name.endsWith('.js')) {
      setNewName('')
      return
    }
    if (files.some((file) => file.name === name)) {
      setNewName('')
      return
    }
    onCreate(name)
    setNewName('')
    setCreating(false)
  }

  function handleRename(id: string) {
    const name = renameValue.trim()
    if (!name.endsWith('.js')) {
      setRenamingId(null)
      return
    }
    if (files.some((file) => file.name === name && file.id !== id)) {
      setRenamingId(null)
      return
    }
    onRename(id, name)
    setRenamingId(null)
  }

  return (
    <div
      className={`file-explorer ${dragging ? 'file-explorer-dragging' : ''}`}
      ref={explorerRef}
      style={{ width, minWidth: width }}
    >
      <div className="file-explorer-resize-handle" onMouseDown={handleResizeStart} />
      <div className="file-explorer-header">
        <div className="file-explorer-tabs">
          <span className="file-explorer-tab file-explorer-tab-active">Files</span>
        </div>
        <div className="file-explorer-actions">
          <button className="file-explorer-create" onClick={() => setCreating(true)} title="New file">
            +
          </button>
          <button className="file-explorer-toggle" onClick={onToggle} title="Hide explorer">
            {'\u2039'}
          </button>
        </div>
      </div>
      <div className="file-list">
        {creating && (
          <div className="file-item file-item-new">
            <span className="file-icon">{'\u2630'}</span>
            <input
              ref={createRef}
              className="file-rename-input"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') confirmCreate()
                if (event.key === 'Escape') {
                  setCreating(false)
                  setNewName('')
                }
              }}
              onBlur={() => {
                setCreating(false)
                setNewName('')
              }}
              placeholder="name.js"
            />
          </div>
        )}
        {files.map((file) => (
          <div
            key={file.id}
            className={`file-item ${file.id === activeFileId ? 'file-item-active' : ''}`}
            onClick={() => onSelect(file.id)}
          >
            <span className="file-icon">{'\u2630'}</span>
            {renamingId === file.id ? (
              <input
                ref={renameRef}
                className="file-rename-input"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onBlur={() => handleRename(file.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleRename(file.id)
                  if (event.key === 'Escape') setRenamingId(null)
                }}
                onClick={(event) => event.stopPropagation()}
              />
            ) : (
              <span className="file-name">
                {file.name}
                {file.isEntry && <span className="file-entry-badge">entry</span>}
              </span>
            )}
            <div className="file-actions">
              <button
                className="file-action"
                title="Rename"
                onClick={(event) => {
                  event.stopPropagation()
                  setRenamingId(file.id)
                  setRenameValue(file.name)
                }}
              >
                {'\u270E'}
              </button>
              {!file.isEntry && (
                <button
                  className="file-action file-action-danger"
                  title="Delete"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete(file.id)
                  }}
                >
                  {'\u2715'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="file-explorer-footer">Import modules with <code>./name.js</code></div>
    </div>
  )
}
