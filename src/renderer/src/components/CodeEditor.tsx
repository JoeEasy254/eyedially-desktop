import { memo, useRef, useEffect, useState, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import '../lib/monaco'
import { playClick } from '../hooks/useKeyboardSound'
import { buildVirtualSource, mapMarkersToVisible } from '../lib/sandboxValidation'
import { getTypeScriptApi, installSandboxSupport, setSandboxFileNames } from '../lib/monacoSupport'
import type { MarkerLike } from '../lib/sandboxValidation'

const OPTIONS = {
  minimap: { enabled: true, renderCharacters: false, maxColumn: 100 },
  fontSize: 14,
  lineNumbers: 'on' as const,
  scrollBeyondLastLine: false,
  formatOnPaste: false,
  formatOnType: false,
  padding: { top: 12, bottom: 12 },
  tabSize: 2,
  wordWrap: 'off' as const,
  folding: true,
  suggestOnTriggerCharacters: true,
  quickSuggestions: true,
  parameterHints: { enabled: true },
  bracketPairColorization: { enabled: true },
  matchBrackets: 'always' as const,
  autoClosingBrackets: 'languageDefined' as const,
  autoClosingQuotes: 'languageDefined' as const,
  selectionHighlight: true,
  occurrencesHighlight: 'singleFile' as const,
  codeLens: false,
  colorDecorators: true,
  links: true,
} as const

const EDIT_KEYS = new Set(['Backspace', 'Delete', 'Enter', 'Tab', 'Space', 'Insert'])

const SKELETON_LINE_WIDTHS = [16, 16, 28, 22, 12, 36, 20, 16, 16, 24, 18, 14, 20, 30]

function flattenMessage(messageText: any): string {
  if (typeof messageText === 'string') return messageText
  let out = ''
  let node = messageText
  while (node) {
    out += node.messageText ?? ''
    node = node.next
  }
  return out
}

function CodeEditor({
  value,
  onChange,
  readOnly = false,
  onAttemptEdit,
  height = '100%',
  loading = false,
  onReady,
  sandboxEntry = false,
  fileId = 'main',
  fileNames = [],
  reveal = null,
  revealNonce = 0,
  onMountEditor,
}: {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  onAttemptEdit?: () => void
  height?: string
  loading?: boolean
  onReady?: () => void
  sandboxEntry?: boolean
  fileId?: string
  fileNames?: string[]
  reveal?: { line: number; column: number } | null
  revealNonce?: number
  onMountEditor?: (editor: any) => void
}) {
  const disposablesRef = useRef<{ dispose: () => void }[]>([])
  const readOnlyRef = useRef(readOnly)
  const onAttemptEditRef = useRef(onAttemptEdit)
  const [isReady, setIsReady] = useState(false)
  const hasSignaledReadyRef = useRef(false)
  const [appTheme, setAppTheme] = useState<'light' | 'dark'>(
    typeof document !== 'undefined' &&
      document.documentElement.getAttribute('data-app-theme') === 'dark'
      ? 'dark'
      : 'light',
  )

  useEffect(() => {
    const root = document.documentElement
    setAppTheme(root.getAttribute('data-app-theme') === 'dark' ? 'dark' : 'light')
    const observer = new MutationObserver(() => {
      setAppTheme(root.getAttribute('data-app-theme') === 'dark' ? 'dark' : 'light')
    })
    observer.observe(root, { attributes: true, attributeFilter: ['data-app-theme'] })
    return () => observer.disconnect()
  }, [])
  const monacoRef = useRef<any>(null)
  const editorRef = useRef<any>(null)
  const revealRef = useRef(reveal)
  const visibleModelRef = useRef<any>(null)
  const hiddenModelRef = useRef<any>(null)
  const hiddenUriRef = useRef<any>(null)
  const valueRef = useRef(value)
  const latestValueRef = useRef(value)
  latestValueRef.current = value
  const prefixLinesRef = useRef(0)
  const validateSeqRef = useRef(0)
  const validateTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    readOnlyRef.current = readOnly
    onAttemptEditRef.current = onAttemptEdit
    valueRef.current = value
  }, [readOnly, onAttemptEdit, value])

  useEffect(() => {
    setSandboxFileNames(fileNames)
  }, [fileNames])

  function handleBeforeMount(monaco: any) {
    monacoRef.current = monaco
    installSandboxSupport(monaco)
    const typescript = getTypeScriptApi(monaco)
    // Enable type checking of JS files so TypeScript's suggestion diagnostics
    // include unused declarations (TS6133, tagged Unnecessary so they dim).
    // noImplicitAny is turned off so untyped JS parameters don't surface as
    // errors; under checkJs they stay suggestions (TS7044) that our filter
    // below intentionally drops.
    typescript.javascriptDefaults.setCompilerOptions({
      ...typescript.javascriptDefaults.getCompilerOptions(),
      allowJs: true,
      checkJs: true,
      noImplicitAny: false,
    })
    // Disable Monaco's built-in JS diagnostics entirely. Validation is driven
    // through a hidden model whose source mirrors the runtime's view of the
    // code, so the visible model never sees Monaco's false positives.
    typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
      noSuggestionDiagnostics: true,
    })
  }

  const applyReveal = useCallback(() => {
    const editor = editorRef.current
    const target = revealRef.current
    if (!editor || !target) return
    const lineNumber = Math.max(1, target.line)
    const column = Math.max(1, target.column)
    editor.setPosition({ lineNumber, column })
    editor.revealPositionInCenter({ lineNumber, column })
    editor.focus()
  }, [])

  const validate = useCallback(async () => {
    const monaco = monacoRef.current
    const hiddenModel = hiddenModelRef.current
    const visibleModel = visibleModelRef.current
    const hiddenUri = hiddenUriRef.current
    if (!monaco || !hiddenModel || !visibleModel || !hiddenUri) return
    const seq = ++validateSeqRef.current
    try {
      // getJavaScriptWorker() returns the worker-manager callable
      // (...uris) => worker-proxy; it must be invoked with the model URI so the
      // worker syncs (withSyncedResources) and returns a proxy with the
      // diagnostics methods.
      const workerGetter = await getTypeScriptApi(monaco).getJavaScriptWorker()
      if (seq !== validateSeqRef.current || hiddenModel.isDisposed()) return
      const worker = await workerGetter(hiddenUri)
      // Surface real errors (syntactic + semantic: undefined names, etc.) plus
      // "unnecessary" suggestions (unused declarations, unused imports) so they
      // render dimmed via the MarkerTag.Unnecessary marker. Other suggestion
      // diagnostics (missing semicolons, etc.) are intentionally excluded.
      const uri = hiddenUri.toString()
      const [syntax, semantic, suggestions] = await Promise.all([
        worker.getSyntacticDiagnostics(uri),
        worker.getSemanticDiagnostics(uri),
        worker.getSuggestionDiagnostics(uri),
      ])
      if (seq !== validateSeqRef.current || hiddenModel.isDisposed() || visibleModel.isDisposed()) return
      const raw = [...syntax, ...semantic, ...suggestions]
        .filter((d: any) => d.category === 1 || (d.category === 2 && d.reportsUnnecessary))
        .map((d: any) => {
          const start = d.start ?? 0
          const length = d.length ?? 1
          const startPos = hiddenModel.getPositionAt(start)
          const endPos = hiddenModel.getPositionAt(start + length)
          const tags: number[] = []
          if (d.reportsUnnecessary) tags.push(1)
          if (d.reportsDeprecated) tags.push(2)
          return {
            severity: d.category === 1 ? 8 : d.category === 0 ? 4 : d.category === 3 ? 2 : 1,
            startLineNumber: startPos.lineNumber,
            startColumn: startPos.column,
            endLineNumber: endPos.lineNumber,
            endColumn: endPos.column,
            message: flattenMessage(d.messageText),
            code: String(d.code ?? ''),
            tags,
          } as MarkerLike
        })
      const mapped = mapMarkersToVisible(raw, prefixLinesRef.current, visibleModel.getLineCount())
      monaco.editor.setModelMarkers(visibleModel, 'angaza-sandbox', mapped)
    } catch {
      // Worker not ready yet — the debounced effect will retry.
    }
  }, [])

  function handleMount(editor: unknown, monaco: any) {
    if (!hasSignaledReadyRef.current) {
      hasSignaledReadyRef.current = true
      setIsReady(true)
      onReady?.()
    }

    monacoRef.current = monaco
    const mEditor = editor as {
      onKeyDown: (cb: (e: { browserEvent: KeyboardEvent }) => void) => { dispose: () => void }
      layout?: () => void
      getDomNode?: () => HTMLElement | null
      getModel: () => any
    }
    editorRef.current = mEditor
    try { onMountEditor?.(mEditor) } catch { /* noop */ }

    const visibleModel = mEditor.getModel()
    visibleModelRef.current = visibleModel

    const { source, prefixLines } = buildVirtualSource(valueRef.current, sandboxEntry)
    prefixLinesRef.current = prefixLines
    const hiddenUri = monaco.Uri.parse(`inmemory://angaza-sandbox/${fileId}`)
    monaco.editor.getModel(hiddenUri)?.dispose()
    hiddenUriRef.current = hiddenUri
    hiddenModelRef.current = monaco.editor.createModel(source, 'javascript', hiddenUri)
    validate()
    applyReveal()

    const disposable = mEditor.onKeyDown((e) => {
      const ev = e.browserEvent
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return
      if (ev.key === 'Shift' || ev.key === 'Meta' || ev.key === 'Control' || ev.key === 'Alt') return

      if (readOnlyRef.current) {
        const isPrintable = ev.key.length === 1
        if (isPrintable || EDIT_KEYS.has(ev.key)) {
          onAttemptEditRef.current?.()
        }
        return
      }
      playClick()
    })

    disposablesRef.current.push(disposable)

    const observer = new ResizeObserver(() => mEditor.layout?.())
    const dom = mEditor.getDomNode?.()
    if (dom) observer.observe(dom.parentElement ?? dom)
    disposablesRef.current.push({ dispose: () => observer.disconnect() })
  }

  const handleChange = useCallback((newValue: string | undefined) => {
    latestValueRef.current = newValue ?? ''
    onChange(newValue ?? '')
  }, [onChange])

  useEffect(() => {
    valueRef.current = value
    clearTimeout(validateTimerRef.current)
    validateTimerRef.current = setTimeout(() => {
      if (hiddenModelRef.current && !hiddenModelRef.current.isDisposed()) {
        const { source, prefixLines } = buildVirtualSource(value, sandboxEntry)
        prefixLinesRef.current = prefixLines
        hiddenModelRef.current.setValue(source)
        validate()
      }
    }, 250)
    return () => clearTimeout(validateTimerRef.current)
  }, [value, sandboxEntry, validate])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const latest = latestValueRef.current
    if (latest === editor.getValue()) return
    if (readOnlyRef.current) {
      editor.setValue(latest)
    } else {
      const model = editor.getModel()
      editor.executeEdits('', [{ range: model.getFullModelRange(), text: latest, forceMoveMarkers: true }])
      editor.pushUndoStop()
    }
  }, [value])

  useEffect(() => {
    revealRef.current = reveal
    if (reveal) applyReveal()
  }, [reveal, revealNonce, applyReveal])

  useEffect(() => {
    return () => {
      clearTimeout(validateTimerRef.current)
      validateSeqRef.current++
      for (const d of disposablesRef.current) d.dispose()
      disposablesRef.current = []
      if (hiddenModelRef.current && !hiddenModelRef.current.isDisposed()) {
        const visibleModel = visibleModelRef.current
        if (visibleModel && !visibleModel.isDisposed()) {
          monacoRef.current?.editor.setModelMarkers(visibleModel, 'angaza-sandbox', [])
        }
        hiddenModelRef.current.dispose()
        hiddenModelRef.current = null
      }
    }
  }, [])

  const showSkeleton = !isReady || loading

  return (
    <div className="editor-wrapper">
      {showSkeleton && (
        <div className="editor-loading-skeleton-overlay">
          <div className="editor-loading-skeleton">
            <div className="skeleton-editor-area">
              {SKELETON_LINE_WIDTHS.map((w, i) => (
                <div
                  key={i}
                  className="skeleton-pulse skeleton-line"
                  style={{ width: `${w}%`, height: '14px', marginBottom: '6px' }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      <Editor
        height={height}
        language="javascript"
        theme={appTheme === 'light' ? 'light' : 'vs-dark'}
        defaultValue={value}
        onChange={handleChange}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        loading={<div className="skeleton-pulse skeleton-block" />}
        options={{ ...OPTIONS, readOnly, domReadOnly: readOnly }}
      />
    </div>
  )
}

export default memo(CodeEditor)
