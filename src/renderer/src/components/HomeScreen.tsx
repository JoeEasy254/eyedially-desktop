import { FolderOpen, Plus, Sparkles, Upload } from 'lucide-react'
import type { ProjectSummary } from '@shared/types'
import { EXAMPLES } from '../lib/starter'
import type { Preset } from '../lib/presets'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

export default function HomeScreen({
  projects,
  loading,
  onOpen,
  onNew,
  onImport,
  onLibrary,
  onUseExample,
}: {
  projects: ProjectSummary[]
  loading: boolean
  onOpen: (id: string) => void
  onNew: () => void
  onImport: () => void
  onLibrary: () => void
  onUseExample: (preset: Preset) => void
}) {
  const recent = projects.slice(0, 6)

  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-hero-badge">
          <Sparkles size={14} />
          <span>Local particle sandbox</span>
        </div>
        <h1>Angaza Sandbox</h1>
        <p className="home-hero-copy">
          Write JavaScript, watch particles move, and explore the physics frame by frame. Every project
          lives on this machine.
        </p>
        <div className="home-hero-actions">
          <button className="btn-primary home-primary" onClick={onNew}>
            <Plus size={16} />
            New project
          </button>
          <button className="home-secondary" onClick={onImport}>
            <Upload size={15} />
            Import
          </button>
          <button className="home-secondary" onClick={onLibrary}>
            <FolderOpen size={15} />
            Project library
          </button>
        </div>
        <div className="home-hero-glow" aria-hidden="true" />
      </section>

      <section className="home-section">
        <div className="home-section-head">
          <h2>Recent projects</h2>
          {projects.length > recent.length && (
            <button className="home-link" onClick={onLibrary}>
              View all {projects.length}
            </button>
          )}
        </div>
        {loading && <div className="home-empty">Loading projects…</div>}
        {!loading && recent.length === 0 && (
          <div className="home-empty">
            No projects yet. Start a blank simulation or pick an example below.
          </div>
        )}
        <div className="home-project-grid">
          {recent.map((project) => (
            <button className="home-project-card" key={project.id} onClick={() => onOpen(project.id)}>
              <span className="home-project-name">{project.name}</span>
              <span className="home-project-meta">
                {project.fileCount} file{project.fileCount === 1 ? '' : 's'} · {formatDate(project.updatedAt)}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-head">
          <h2>Examples</h2>
          <span className="home-section-note">Start from a working simulation</span>
        </div>
        <div className="home-example-grid">
          {EXAMPLES.map((example) => (
            <button className="home-example-card" key={example.id} onClick={() => onUseExample(example)}>
              <span className="home-example-title">{example.title}</span>
              <span className="home-example-copy">{example.description}</span>
              <span className="home-example-cta">Use example</span>
            </button>
          ))}
        </div>
      </section>

      <footer className="home-footer">Everything stays on this machine. No account, no cloud.</footer>
    </div>
  )
}
