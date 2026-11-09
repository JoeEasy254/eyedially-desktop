import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Group as PanelGroup,
  Panel,
  Separator,
  type PanelImperativeHandle,
} from 'react-resizable-panels'
import {
  Atom,
  Code2,
  Columns2,
  FolderOpen,
  MonitorPlay,
  PanelLeft,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
} from 'lucide-react'
import type { DesktopProject, MenuAction, ProjectSummary } from '@shared/types'
import CodeEditor from './components/CodeEditor'
import EditorTabs from './components/EditorTabs'
import FileExplorer from './components/FileExplorer'
import HomeScreen from './components/HomeScreen'
import NewProjectModal from './components/NewProjectModal'
import ProjectLibrary from './components/ProjectLibrary'
import PromptModal from './components/PromptModal'
import SearchOverlay from './components/SearchOverlay'
import ThemeToggle from './components/ThemeToggle'
import MeasureOverlay from './components/editor/MeasureOverlay'
import MotionOverlay from './components/editor/MotionOverlay'
import ValueGraphs from './components/editor/ValueGraphs'
import VizToolbar from './components/editor/VizToolbar'
import { useKeys } from './hooks/useKeys'
import { useLiveCode } from './hooks/useLiveCode'
import { SampleRecorder, MotionTracker, parseNumber, type MotionArrow } from './lib/analyzer'
import { setAiMouse, setAiMouseLeave } from './lib/ai'
import type { Preset } from './lib/presets'
import { createFilesForTemplate } from './lib/starter'
import Canvas2D from './renderers/Canvas2D'
import type { FrameResult } from './types/FrameResult'

type ViewMode = 'split' | 'editor' | 'preview'
type SaveState = 'saved' | 'saving' | 'error'

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

function readStoredView(): ViewMode {
  const saved = localStorage.getItem('angaza-view')
  return saved === 'editor' || saved === 'preview' ? saved : 'split'
}

let fileCounter = 1

function createFileId(): string {
  return `file-${Date.now()}-${fileCounter++}`
}

export default function App() {
  const [project, setProject] = useState<DesktopProject | null>(null)
  const projectRef = useRef<DesktopProject | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [activeFileId, setActiveFileId] = useState('main')
  const [openFileIds, setOpenFileIds] = useState<string[]>(['main'])
  const [view, setView] = useState<ViewMode>(readStoredView)
  const [showFiles, setShowFiles] = useState(() => localStorage.getItem('angaza-explorer') !== 'off')
  const [previewOpen, setPreviewOpen] = useState(() => localStorage.getItem('angaza-preview') !== 'off')
  const [editorMaximized, setEditorMaximized] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [revealTarget, setRevealTarget] = useState<{ line: number; column: number; nonce: number } | null>(
    null
  )
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [notice, setNotice] = useState<string | null>(null)

  const previewPanelRef = useRef<PanelImperativeHandle | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const notify = useCallback((message: string) => {
    setNotice(message)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 4200)
  }, [])

  useEffect(() => {
    projectRef.current = project
  }, [project])

  useEffect(() => {
    localStorage.setItem('angaza-view', view)
  }, [view])

  useEffect(() => {
    localStorage.setItem('angaza-explorer', showFiles ? 'on' : 'off')
  }, [showFiles])

  useEffect(() => {
    localStorage.setItem('angaza-preview', previewOpen ? 'on' : 'off')
  }, [previewOpen])

  useEffect(() => {
    const panel = previewPanelRef.current
    if (!panel) return
    if (previewOpen && panel.isCollapsed()) panel.expand()
    else if (!previewOpen && !panel.isCollapsed()) panel.collapse()
  }, [previewOpen])

  const files = project?.files ?? []
  const activeFile = files.find((file) => file.id === activeFileId) ?? files[0]

  const canvasFocusedRef = useRef(false)
  const canvasCaptureRef = useRef<HTMLCanvasElement | null>(null)
  const keysRef = useKeys(canvasFocusedRef)
  const { frame, error, paused, restart, togglePause, setPaused, handleCanvasClick } = useLiveCode(
    files,
    keysRef
  )

  const recorderRef = useRef<SampleRecorder>(new SampleRecorder())
  const motionTrackerRef = useRef<MotionTracker>(new MotionTracker())
  const arrowsRef = useRef<MotionArrow[]>([])
  const simTimeRef = useRef(0)
  const frameCountRef = useRef(0)
  const vectorsOnRef = useRef(false)
  const [speed, setSpeed] = useState(1)
  const [stepKey, setStepKey] = useState(0)
  const [graphsOn, setGraphsOn] = useState(false)
  const [vectorsOn, setVectorsOn] = useState(false)
  const [measureOn, setMeasureOn] = useState(false)
  const [graphKeys, setGraphKeys] = useState<Set<string>>(new Set())
  const [readout, setReadout] = useState({ t: 0, f: 0 })

  useEffect(() => {
    vectorsOnRef.current = vectorsOn
  }, [vectorsOn])

  const resetAnalyzer = useCallback(() => {
    recorderRef.current.reset()
    motionTrackerRef.current.reset()
    arrowsRef.current = []
    simTimeRef.current = 0
    frameCountRef.current = 0
  }, [])

  useEffect(() => {
    resetAnalyzer()
  }, [files, resetAnalyzer])

  useEffect(() => {
    const id = setInterval(() => {
      setReadout({ t: simTimeRef.current, f: frameCountRef.current })
    }, 200)
    return () => clearInterval(id)
  }, [])

  const handleFrameResult = useCallback((result: FrameResult | null, dt: number) => {
    if (!result) return
    simTimeRef.current += dt
    frameCountRef.current += 1
    const values: Record<string, number> = {}
    if (result.text) {
      for (const [key, value] of Object.entries(result.text)) {
        const parsed = parseNumber(value)
        if (parsed !== null) values[key] = parsed
      }
    }
    recorderRef.current.push(simTimeRef.current, values)
    if (vectorsOnRef.current) {
      arrowsRef.current = motionTrackerRef.current.update(result, dt, { speed: true })
    }
  }, [])

  const cycleSpeed = useCallback(() => {
    setSpeed((value) => (value === 1 ? 0.5 : value === 0.5 ? 0.25 : 1))
  }, [])

  const handleStep = useCallback(() => {
    setPaused(true)
    setStepKey((value) => value + 1)
  }, [setPaused])

  const handleRestart = useCallback(() => {
    restart()
    resetAnalyzer()
  }, [restart, resetAnalyzer])

  const handleToggleGraphs = useCallback(() => {
    if (!graphsOn && graphKeys.size === 0) setGraphKeys(new Set(recorderRef.current.keys()))
    setGraphsOn((value) => !value)
  }, [graphsOn, graphKeys])

  const handleToggleGraphKey = useCallback((key: string) => {
    setGraphKeys((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const markDirty = useCallback(() => {
    setDirty(true)
    setSaveState('saved')
  }, [])

  const updateProject = useCallback(
    (updater: (current: DesktopProject) => DesktopProject) => {
      setProject((current) => (current ? updater(current) : current))
      markDirty()
    },
    [markDirty]
  )

  const handleCodeChange = useCallback(
    (code: string) => {
      if (!activeFile) return
      updateProject((current) => ({
        ...current,
        files: current.files.map((file) => (file.id === activeFile.id ? { ...file, code } : file)),
      }))
    },
    [activeFile, updateProject]
  )

  const handleFileSelect = useCallback((id: string) => {
    setActiveFileId(id)
    setOpenFileIds((previous) => (previous.includes(id) ? previous : [...previous, id]))
  }, [])

  const handleFileCreate = useCallback(
    (name: string) => {
      const id = createFileId()
      updateProject((current) => ({
        ...current,
        files: [...current.files, { id, name, code: '', isEntry: false }],
      }))
      setActiveFileId(id)
      setOpenFileIds((previous) => [...previous, id])
    },
    [updateProject]
  )

  const handleFileRename = useCallback(
    (id: string, name: string) => {
      updateProject((current) => ({
        ...current,
        files: current.files.map((file) => (file.id === id ? { ...file, name } : file)),
      }))
    },
    [updateProject]
  )

  const handleFileDelete = useCallback(
    (id: string) => {
      updateProject((current) => ({
        ...current,
        files: current.files.filter((file) => file.id !== id),
      }))
      setOpenFileIds((previous) => previous.filter((fileId) => fileId !== id))
      if (id === activeFileId) {
        const remaining = openFileIds.filter((fileId) => fileId !== id)
        if (remaining.length > 0) setActiveFileId(remaining[remaining.length - 1])
      }
    },
    [activeFileId, openFileIds, updateProject]
  )

  const handleTabClose = useCallback(
    (id: string) => {
      const remaining = openFileIds.filter((fileId) => fileId !== id)
      setOpenFileIds(remaining)
      if (id === activeFileId && remaining.length > 0) {
        setActiveFileId(remaining[remaining.length - 1])
      }
      if (editorMaximized && remaining.length === 0) {
        setEditorMaximized(false)
        setShowFiles(true)
      }
    },
    [activeFileId, editorMaximized, openFileIds]
  )

  const handleSearchSelect = useCallback(
    (fileId: string, line: number, column: number) => {
      setActiveFileId(fileId)
      setOpenFileIds((previous) => (previous.includes(fileId) ? previous : [...previous, fileId]))
      setSearchOpen(false)
      setRevealTarget((previous) => ({ line, column, nonce: (previous?.nonce ?? 0) + 1 }))
    },
    []
  )

  const applyProject = useCallback(
    (loaded: DesktopProject) => {
      const entry = loaded.files.find((file) => file.isEntry) ?? loaded.files[0]
      setProject(loaded)
      setActiveFileId(entry?.id ?? 'main')
      setOpenFileIds(loaded.files.map((file) => file.id))
      setDirty(false)
      setSaveState('saved')
      setEditorMaximized(false)
      resetAnalyzer()
      restart()
    },
    [resetAnalyzer, restart]
  )

  const refreshProjects = useCallback(async () => {
    setProjectsLoading(true)
    try {
      setProjects(await window.angaza.projects.list())
    } catch (caught) {
      notify(errorMessage(caught))
    } finally {
      setProjectsLoading(false)
    }
  }, [notify])

  useEffect(() => {
    void refreshProjects()
  }, [refreshProjects])

  const saveNow = useCallback(async (): Promise<boolean> => {
    const current = projectRef.current
    if (!current) return true
    setSaveState('saving')
    try {
      const summary = await window.angaza.projects.save(current)
      setDirty(false)
      setSaveState('saved')
      setProject((value) =>
        value && value.id === current.id ? { ...value, updatedAt: summary.updatedAt } : value
      )
      return true
    } catch (caught) {
      setSaveState('error')
      notify(`Could not save: ${errorMessage(caught)}`)
      return false
    }
  }, [notify])

  useEffect(() => {
    if (!project || !dirty) return
    const timer = setTimeout(() => {
      void saveNow()
    }, 650)
    return () => clearTimeout(timer)
  }, [project, dirty, saveNow])

  const openProject = useCallback(
    async (id: string) => {
      try {
        if (!(await saveNow())) return
        const loaded = await window.angaza.projects.load(id)
        applyProject(loaded)
        setLibraryOpen(false)
        setView('split')
      } catch (caught) {
        notify(errorMessage(caught))
      }
    },
    [applyProject, notify, saveNow]
  )

  const createProject = useCallback(
    async (name: string, template: string) => {
      if (!(await saveNow())) throw new Error('The current project could not be saved.')
      const created = await window.angaza.projects.create({
        name,
        template,
        files: createFilesForTemplate(template),
      })
      applyProject(created)
      setNewProjectOpen(false)
      setLibraryOpen(false)
      setView('split')
      await refreshProjects()
    },
    [applyProject, refreshProjects, saveNow]
  )

  const useExample = useCallback(
    (preset: Preset) => {
      void createProject(preset.title, preset.id).catch((caught) => notify(errorMessage(caught)))
    },
    [createProject, notify]
  )

  const importProject = useCallback(async () => {
    try {
      if (!(await saveNow())) return
      const imported = await window.angaza.projects.importProject()
      if (!imported) return
      applyProject(imported)
      setLibraryOpen(false)
      setView('split')
      await refreshProjects()
      notify(`Imported "${imported.name}"`)
    } catch (caught) {
      notify(errorMessage(caught))
    }
  }, [applyProject, notify, refreshProjects, saveNow])

  const exportProject = useCallback(async () => {
    const current = projectRef.current
    if (!current) return
    try {
      await window.angaza.projects.exportProject(current)
    } catch (caught) {
      notify(errorMessage(caught))
    }
  }, [notify])

  const handleReset = useCallback(() => {
    const current = projectRef.current
    if (!current) return
    const nextFiles = createFilesForTemplate(current.template)
    setProject({ ...current, files: nextFiles })
    setActiveFileId(nextFiles[0].id)
    setOpenFileIds(nextFiles.map((file) => file.id))
    markDirty()
    resetAnalyzer()
    restart()
  }, [markDirty, resetAnalyzer, restart])

  const handleScreenshot = useCallback(async () => {
    const canvas = canvasCaptureRef.current
    if (!canvas) return
    try {
      const saved = await window.angaza.screenshots.save(
        canvas.toDataURL('image/png'),
        projectRef.current?.name ?? 'simulation'
      )
      if (saved) notify('Screenshot saved')
    } catch (caught) {
      notify(errorMessage(caught))
    }
  }, [notify])

  const handleLibraryRename = useCallback(
    async (id: string, name: string) => {
      try {
        await window.angaza.projects.rename(id, name)
        setProject((current) => (current && current.id === id ? { ...current, name } : current))
        await refreshProjects()
      } catch (caught) {
        notify(errorMessage(caught))
        throw caught
      }
    },
    [notify, refreshProjects]
  )

  const handleLibraryDelete = useCallback(
    async (id: string) => {
      await window.angaza.projects.remove(id)
      if (projectRef.current?.id === id) {
        projectRef.current = null
        setProject(null)
        setDirty(false)
        setSaveState('saved')
      }
      await refreshProjects()
    },
    [refreshProjects]
  )

  const handleLibraryDuplicate = useCallback(
    async (id: string) => {
      if (!(await saveNow())) return
      const copy = await window.angaza.projects.duplicate(id)
      await refreshProjects()
      applyProject(copy)
      setLibraryOpen(false)
    },
    [applyProject, refreshProjects, saveNow]
  )

  const handleSaveAs = useCallback(
    async (name: string) => {
      const current = projectRef.current
      if (!current) return
      const created = await window.angaza.projects.create({
        name,
        template: current.template,
        files: current.files,
      })
      applyProject(created)
      setSaveAsOpen(false)
      await refreshProjects()
    },
    [applyProject, refreshProjects]
  )

  const goHome = useCallback(() => {
    void saveNow()
    setProject(null)
    setDirty(false)
    setSaveState('saved')
    setEditorMaximized(false)
  }, [saveNow])

  const menuHandlerRef = useRef<(action: MenuAction) => void>(() => {})
  menuHandlerRef.current = (action) => {
    switch (action) {
      case 'new-project':
        setNewProjectOpen(true)
        break
      case 'open-library':
        void refreshProjects()
        setLibraryOpen(true)
        break
      case 'save':
        void saveNow()
        break
      case 'save-as':
        if (projectRef.current) setSaveAsOpen(true)
        break
      case 'import-project':
        void importProject()
        break
      case 'export-project':
        void exportProject()
        break
      case 'view-split':
        setView('split')
        break
      case 'view-editor':
        setView('editor')
        break
      case 'view-preview':
        setView('preview')
        break
      case 'toggle-explorer':
        setShowFiles((value) => !value)
        break
      case 'toggle-theme':
        window.dispatchEvent(new Event('angaza:toggle-theme'))
        break
      case 'toggle-play':
        togglePause()
        break
      case 'restart':
        handleRestart()
        break
      case 'step':
        handleStep()
        break
      case 'cycle-speed':
        cycleSpeed()
        break
      case 'search':
        setSearchOpen(true)
        break
      case 'about':
        break
    }
  }

  useEffect(() => window.angaza.onMenuAction((action) => menuHandlerRef.current(action)), [])

  useEffect(
    () =>
      window.angaza.onRequestClose(() => {
        void (async () => {
          try {
            if (projectRef.current) await window.angaza.projects.save(projectRef.current)
          } catch {
            // Close anyway; the last successful autosave remains on disk.
          } finally {
            window.angaza.confirmClose()
          }
        })()
      }),
    []
  )

  useEffect(() => {
    const name = projectRef.current?.name
    const prefix = dirty ? '• ' : ''
    window.angaza.setTitle(name ? `${prefix}${name} — Angaza Sandbox` : 'Angaza Sandbox')
  }, [project?.name, dirty])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && editorMaximized) setEditorMaximized(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [editorMaximized])

  const editorContent = activeFile ? (
    <>
      <EditorTabs
        files={files}
        activeFileId={activeFileId}
        openFileIds={openFileIds}
        onSelect={handleFileSelect}
        onClose={handleTabClose}
        onMaximize={() => setEditorMaximized((value) => !value)}
        onCloseOverlay={() => setEditorMaximized(false)}
        maximized={editorMaximized}
        onSearch={() => setSearchOpen(true)}
      />
      <CodeEditor
        key={activeFile.id}
        value={activeFile.code}
        onChange={handleCodeChange}
        sandboxEntry={activeFile.isEntry}
        fileId={activeFile.id}
        fileNames={files.map((file) => file.name)}
        reveal={revealTarget ? { line: revealTarget.line, column: revealTarget.column } : null}
        revealNonce={revealTarget?.nonce ?? 0}
      />
    </>
  ) : null

  const canvasArea = (
    <>
      <Canvas2D
        frame={frame}
        paused={paused}
        onClickCanvas={handleCanvasClick}
        error={error}
        focusedRef={canvasFocusedRef}
        speed={speed}
        stepKey={stepKey}
        onResult={handleFrameResult}
        onPointerMove={setAiMouse}
        onPointerLeave={setAiMouseLeave}
        canvasRef={canvasCaptureRef}
      />
      {graphsOn && (
        <ValueGraphs
          recorder={recorderRef.current}
          enabledKeys={graphKeys}
          onToggleKey={handleToggleGraphKey}
        />
      )}
      {vectorsOn && <MotionOverlay arrowsRef={arrowsRef} enabled={vectorsOn} />}
      {measureOn && <MeasureOverlay enabled={measureOn} />}
      <VizToolbar
        paused={paused}
        speed={speed}
        onStep={handleStep}
        onCycleSpeed={cycleSpeed}
        graphsOn={graphsOn}
        onToggleGraphs={handleToggleGraphs}
        vectorsOn={vectorsOn}
        onToggleVectors={() => setVectorsOn((value) => !value)}
        measureOn={measureOn}
        onToggleMeasure={() => setMeasureOn((value) => !value)}
        onScreenshot={() => void handleScreenshot()}
        time={readout.t}
        frame={readout.f}
      />
    </>
  )

  const explorer = (
    <FileExplorer
      files={files}
      activeFileId={activeFileId}
      onSelect={handleFileSelect}
      onCreate={handleFileCreate}
      onRename={handleFileRename}
      onDelete={handleFileDelete}
      onToggle={() => setShowFiles(false)}
    />
  )

  const previewToggle = (
    <button
      type="button"
      className={`split-panel-toggle${previewOpen ? '' : ' split-panel-toggle-collapsed'}`}
      onClick={() =>
        previewPanelRef.current?.isCollapsed()
          ? previewPanelRef.current?.expand()
          : previewPanelRef.current?.collapse()
      }
      title={previewOpen ? 'Hide preview' : 'Show preview'}
      aria-label={previewOpen ? 'Hide preview' : 'Show preview'}
      aria-pressed={!previewOpen}
    >
      {previewOpen ? '›' : '‹'}
    </button>
  )

  const saveLabel =
    saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save failed' : dirty ? 'Unsaved' : 'Saved'

  return (
    <div className="app">
      {notice && (
        <div className="app-banner">
          <span>{notice}</span>
          <button className="app-banner-close" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}

      <header className="header">
        <div className="header-inner">
          <button className="header-brand brand-button" onClick={goHome} title="Back to home">
            <span className="brand-mark">
              <Atom size={20} />
            </span>
            <span className="brand-name">Angaza</span>
            <span className="brand-sub">Sandbox</span>
          </button>

          {project && (
            <div className="header-project">
              <span className="header-project-name">{project.name}</span>
              <span className={`header-save-state header-save-${saveState}`}>
                {dirty && <span className="header-dirty-dot" />}
                {saveLabel}
              </span>
            </div>
          )}

          <div className="header-controls">
            <button className="header-btn" onClick={() => setNewProjectOpen(true)} title="New project">
              <Plus size={14} />
              <span>New</span>
            </button>
            <button
              className="header-btn"
              onClick={() => {
                void refreshProjects()
                setLibraryOpen(true)
              }}
              title="Open project library"
            >
              <FolderOpen size={14} />
              <span>Library</span>
            </button>
            {project && (
              <>
                <button className="header-btn" onClick={() => void saveNow()} title="Save now">
                  <Save size={14} />
                  <span>Save</span>
                </button>
                <span className="header-divider" />
                <button
                  className="header-btn"
                  onClick={togglePause}
                  title={paused ? 'Play (F5)' : 'Pause (F5)'}
                >
                  {paused ? <Play size={14} /> : <Pause size={14} />}
                  <span>{paused ? 'Play' : 'Pause'}</span>
                </button>
                <button className="header-btn" onClick={handleRestart} title="Restart (F7)">
                  <RotateCcw size={14} />
                  <span>Restart</span>
                </button>
                <button className="header-btn" onClick={handleReset} title="Restore the starter code">
                  <RotateCcw size={14} />
                  <span>Reset</span>
                </button>
              </>
            )}
            <span className="header-divider" />
            <ThemeToggle compact />
          </div>
        </div>
      </header>

      {project && (
        <div className="workspace-toolbar">
          <button
            className={`explorer-toggle-btn${showFiles ? ' explorer-toggle-btn-active' : ''}`}
            onClick={() => setShowFiles((value) => !value)}
            title="Toggle file explorer (Ctrl+B)"
          >
            <PanelLeft size={15} />
            <span>Explorer</span>
          </button>
          <div className="learn-view-switch" role="group" aria-label="Workspace layout">
            <button
              className={`learn-view-btn${view === 'split' ? ' learn-view-btn-active' : ''}`}
              onClick={() => setView('split')}
              aria-pressed={view === 'split'}
            >
              <Columns2 size={14} />
              <span>Split</span>
            </button>
            <button
              className={`learn-view-btn${view === 'editor' ? ' learn-view-btn-active' : ''}`}
              onClick={() => setView('editor')}
              aria-pressed={view === 'editor'}
            >
              <Code2 size={14} />
              <span>Editor</span>
            </button>
            <button
              className={`learn-view-btn${view === 'preview' ? ' learn-view-btn-active' : ''}`}
              onClick={() => setView('preview')}
              aria-pressed={view === 'preview'}
            >
              <MonitorPlay size={14} />
              <span>Preview</span>
            </button>
          </div>
        </div>
      )}

      <main className="main-layout main-layout-padded">
        {!project ? (
          <HomeScreen
            projects={projects}
            loading={projectsLoading}
            onOpen={(id) => void openProject(id)}
            onNew={() => setNewProjectOpen(true)}
            onImport={() => void importProject()}
            onLibrary={() => {
              void refreshProjects()
              setLibraryOpen(true)
            }}
            onUseExample={useExample}
          />
        ) : view === 'editor' ? (
          <div className="main-layout-full">
            <div className="panel-left">
              {showFiles && explorer}
              <div className="editor-section" id="editor">
                {editorContent}
              </div>
            </div>
          </div>
        ) : view === 'preview' ? (
          <div className="main-layout-full">
            <div className="viz-body">{canvasArea}</div>
          </div>
        ) : (
          <PanelGroup orientation="horizontal" id="angaza-split">
            <Panel defaultSize={showFiles ? 48 : 50} minSize={24}>
              <div className="panel-left">
                {showFiles && explorer}
                <div className="editor-section" id="editor">
                  {editorContent}
                </div>
              </div>
            </Panel>
            <Separator className="split-separator">{previewToggle}</Separator>
            <Panel
              defaultSize={previewOpen ? (showFiles ? 52 : 50) : 0}
              minSize={22}
              collapsible
              collapsedSize={0}
              panelRef={previewPanelRef}
              onResize={(size) => setPreviewOpen(size.asPercentage >= 1)}
            >
              <div className="panel-right">
                <div className="viz-body">{canvasArea}</div>
              </div>
            </Panel>
          </PanelGroup>
        )}
      </main>

      {editorMaximized &&
        createPortal(
          <div className="editor-maximized-overlay" role="dialog" aria-label="Editor maximized">
            {editorContent}
          </div>,
          document.body
        )}

      {libraryOpen && (
        <ProjectLibrary
          projects={projects}
          currentId={project?.id ?? null}
          loading={projectsLoading}
          onClose={() => setLibraryOpen(false)}
          onOpen={(id) => void openProject(id)}
          onNew={() => setNewProjectOpen(true)}
          onImport={() => void importProject()}
          onDelete={handleLibraryDelete}
          onDuplicate={handleLibraryDuplicate}
          onRename={handleLibraryRename}
          onExportCurrent={() => void exportProject()}
          onOpenFolder={() => void window.angaza.openProjectsFolder()}
        />
      )}

      {newProjectOpen && (
        <NewProjectModal onClose={() => setNewProjectOpen(false)} onCreate={createProject} />
      )}

      {saveAsOpen && project && (
        <PromptModal
          title="Save as new project"
          label="Project name"
          initialValue={`${project.name} copy`}
          submitLabel="Save as"
          onClose={() => setSaveAsOpen(false)}
          onSubmit={handleSaveAs}
        />
      )}

      {searchOpen && (
        <SearchOverlay
          files={files}
          onClose={() => setSearchOpen(false)}
          onSelect={handleSearchSelect}
        />
      )}
    </div>
  )
}
