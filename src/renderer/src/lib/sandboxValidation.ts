import { rewriteImports } from './bundler'

export interface VirtualSource {
  source: string
  prefixLines: number
}

// The hidden validation model is plain JavaScript (matching Monaco's JS
// diagnostics: syntactic + suggestion, no semantic). Entry files are wrapped in
// a function so the template's top-level `return { ... }` is legal, mirroring
// how the runtime executes entry code inside an arrow function. Sandbox globals
// (time, dt, state, w, h, keys, assets, __modules, exports, module) are free
// identifiers, which JS mode never flags.
export function buildVirtualSource(code: string, isEntry: boolean): VirtualSource {
  const rewritten = rewriteImports(code)
  if (isEntry) {
    const prefixLines = 1
    const source = `function frame() {\n${rewritten}\n}\nframe();\n`
    return { source, prefixLines }
  }
  return { source: rewritten, prefixLines: 0 }
}

export interface MarkerLike {
  severity: number
  message: string
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
  tags?: number[]
}

export function mapMarkersToVisible(
  markers: MarkerLike[],
  prefixLines: number,
  visibleLineCount: number
): MarkerLike[] {
  const out: MarkerLike[] = []
  for (const m of markers) {
    if (m.startLineNumber <= prefixLines) continue
    const startLineNumber = m.startLineNumber - prefixLines
    const endLineNumber = Math.min(m.endLineNumber - prefixLines, visibleLineCount)
    if (startLineNumber > visibleLineCount) continue
    out.push({
      severity: m.severity,
      message: m.message,
      startLineNumber,
      startColumn: m.startColumn,
      endLineNumber,
      endColumn: m.endColumn,
      tags: m.tags,
    })
  }
  return out
}
