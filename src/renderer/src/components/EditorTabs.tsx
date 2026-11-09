import { useState } from 'react'
import type { ProjectFile } from '../types/ProjectFile'
import { setKeyboardSoundEnabled, isKeyboardSoundEnabled } from '../hooks/useKeyboardSound'

export default function EditorTabs({
  files,
  activeFileId,
  openFileIds,
  onSelect,
  onClose,
  onMaximize,
  onCloseOverlay,
  maximized,
  onSearch,
}: {
  files: ProjectFile[]
  activeFileId: string
  openFileIds: string[]
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onMaximize: () => void
  onCloseOverlay?: () => void
  maximized: boolean
  onSearch?: () => void
}) {
  const [soundOn, setSoundOn] = useState(isKeyboardSoundEnabled())
  const openFiles = openFileIds
    .map((id) => files.find((f) => f.id === id))
    .filter((f): f is ProjectFile => f !== undefined)

  return (
    <div className="editor-tabs">
      <div className="editor-tabs-scroll">
        {openFiles.map((f) => (
          <div
            key={f.id}
            className={`editor-tab ${f.id === activeFileId ? 'active' : ''}`}
            onClick={() => onSelect(f.id)}
          >
            <span className="editor-tab-name">{f.name}</span>
            <button
              className="editor-tab-close"
              onClick={(e) => {
                e.stopPropagation()
                onClose(f.id)
              }}
              title="Close tab"
            >
              {'\u2715'}
            </button>
          </div>
        ))}
      </div>
      <div className="editor-tab-actions">
        {onSearch && (
          <button
            className="editor-tab-btn"
            onClick={onSearch}
            title="Search across files (Ctrl+Shift+F)"
          >
            {'\u{1F50D}'}
          </button>
        )}
        <button
          className={'editor-tab-btn' + (soundOn ? '' : ' editor-tab-btn-off')}
          onClick={() => {
            const next = !soundOn
            setSoundOn(next)
            setKeyboardSoundEnabled(next)
          }}
          title={soundOn ? 'Mute keyboard sounds' : 'Enable keyboard sounds'}
        >
          {soundOn ? '\u266B' : '\u266A'}
        </button>
        {maximized && onCloseOverlay && (
          <button
            className="editor-tab-btn"
            onClick={onCloseOverlay}
            title="Close (Esc)"
          >
            {'\u2715'}
          </button>
        )}
        <button
          className="editor-tab-btn"
          onClick={onMaximize}
          title={maximized ? 'Restore split view' : 'Maximize editor'}
        >
          {maximized ? '\u2923' : '\u2922'}
        </button>
      </div>
    </div>
  )
}
