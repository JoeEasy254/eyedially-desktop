import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectFile } from '../types/ProjectFile'

interface Match {
  fileId: string
  fileName: string
  line: number
  column: number
  matchLength: number
  text: string
}

function buildRegex(query: string, caseSensitive: boolean): RegExp | null {
  if (!query) return null
  try {
    return new RegExp(query, caseSensitive ? 'g' : 'gi')
  } catch {
    return null
  }
}

export default function SearchOverlay({
  files,
  onClose,
  onSelect,
}: {
  files: ProjectFile[]
  onClose: () => void
  onSelect: (fileId: string, line: number, column: number) => void
}) {
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = useMemo(() => {
    const list: Match[] = []
    if (!query) return list
    const regex = useRegex ? buildRegex(query, caseSensitive) : null
    for (const file of files) {
      const lines = file.code.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (regex) {
          regex.lastIndex = 0
          let m: RegExpExecArray | null
          while ((m = regex.exec(line)) !== null) {
            list.push({
              fileId: file.id,
              fileName: file.name,
              line: i + 1,
              column: m.index + 1,
              matchLength: m[0].length || 1,
              text: line,
            })
            if (m.index === regex.lastIndex) regex.lastIndex++
          }
        } else {
          const needle = caseSensitive ? query : query.toLowerCase()
          const hay = caseSensitive ? line : line.toLowerCase()
          let idx = hay.indexOf(needle)
          while (idx !== -1) {
            list.push({
              fileId: file.id,
              fileName: file.name,
              line: i + 1,
              column: idx + 1,
              matchLength: needle.length,
              text: line,
            })
            idx = hay.indexOf(needle, idx + needle.length)
          }
        }
      }
    }
    return list
  }, [files, query, caseSensitive, useRegex])

  const groups = useMemo(() => {
    const map = new Map<string, Match[]>()
    for (const r of results) {
      if (!map.has(r.fileId)) map.set(r.fileId, [])
      map.get(r.fileId)!.push(r)
    }
    return [...map.entries()]
  }, [results])

  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(results.length - 1, 0)))
  }, [results])

  function select(match: Match) {
    onSelect(match.fileId, match.line, match.column)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = results[activeIndex]
      if (hit) select(hit)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (results.length > 0) setActiveIndex((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (results.length > 0) setActiveIndex((i) => (i - 1 + results.length) % results.length)
    }
  }

  return (
    <div className="search-backdrop" onClick={onClose}>
      <div
        className="search-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-label="Search across files"
      >
        <div className="search-modal-header">
          <span className="search-modal-title">Search across files</span>
          <button className="modal-close" onClick={onClose} title="Close (Esc)">
            {'\u2715'}
          </button>
        </div>
        <div className="search-input-row">
          <input
            ref={inputRef}
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code…"
            spellCheck={false}
            autoComplete="off"
          />
          <label className="search-toggle">
            <input
              type="checkbox"
              checked={useRegex}
              onChange={(e) => setUseRegex(e.target.checked)}
            />
            Regex
          </label>
          <label className="search-toggle">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
            />
            Match case
          </label>
        </div>
        <div className="search-meta">
          {query ? `${results.length} match${results.length === 1 ? '' : 'es'} in ${groups.length} file${groups.length === 1 ? '' : 's'}` : 'Type to search across all project files'}
        </div>
        <div className="search-results">
          {groups.length === 0 && query ? (
            <div className="search-empty">No results for “{query}”</div>
          ) : (
            groups.map(([fileId, matches], gi) => (
              <div key={fileId} className="search-group">
                <div className="search-file">
                  <span className="search-file-name">{matches[0].fileName}</span>
                  <span className="search-file-count">{matches.length}</span>
                </div>
                {matches.map((m, mi) => {
                  const index = groups.slice(0, gi).reduce((acc, [, ms]) => acc + ms.length, 0) + mi
                  const before = m.text.slice(0, m.column - 1)
                  const match = m.text.slice(m.column - 1, m.column - 1 + m.matchLength)
                  const after = m.text.slice(m.column - 1 + m.matchLength)
                  return (
                    <button
                      key={`${m.line}-${m.column}`}
                      className={`search-result${index === activeIndex ? ' active' : ''}`}
                      onClick={() => select(m)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <span className="search-result-line">{m.line}</span>
                      <span className="search-result-text">
                        {before}
                        <mark className="search-result-mark">{match}</mark>
                        {after}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
        <div className="search-modal-footer">
          <span>Enter to open · ↑/↓ to navigate · Esc to close</span>
        </div>
      </div>
    </div>
  )
}
