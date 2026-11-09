import type { ProjectFile } from '../types/ProjectFile'
import { ai } from './ai'
import { guardLoops } from './loopGuard'

const IMPORT_RE =
  /^import\s+(?:\{([^}]*)\}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm

const AI_MODULE_SPEC = 'ai'

interface ParsedImport {
  match: string
  specifier: string
  names: string
  kind: 'named' | 'default' | 'namespace'
  local: string
}

function isAiModule(specifier: string): boolean {
  return specifier === AI_MODULE_SPEC
}

function normalizeSpecifier(spec: string): string {
  return spec.replace(/^\.\.?[/\\]/, '')
}

function resolveFile(specifier: string, fileMap: Map<string, ProjectFile>): string | null {
  const normalized = normalizeSpecifier(specifier)
  const candidates = [normalized, normalized + '.js']
  for (const candidate of candidates) {
    if (fileMap.has(candidate)) return candidate
  }
  return null
}

function findCircular(
  file: string,
  deps: Map<string, string[]>,
  visited: Set<string> = new Set(),
  stack: Set<string> = new Set()
): string | null {
  if (stack.has(file)) return file
  if (visited.has(file)) return null
  visited.add(file)
  stack.add(file)
  for (const dep of deps.get(file) || []) {
    const cycle = findCircular(dep, deps, visited, stack)
    if (cycle) return cycle
  }
  stack.delete(file)
  return null
}

function collectImports(code: string): ParsedImport[] {
  const matches: ParsedImport[] = []
  let match: RegExpExecArray | null
  IMPORT_RE.lastIndex = 0
  while ((match = IMPORT_RE.exec(code))) {
    const named = match[1] ?? ''
    const namespace = match[2]
    const defaultName = match[3]
    const specifier = match[4]
    const kind: ParsedImport['kind'] = namespace ? 'namespace' : defaultName ? 'default' : 'named'
    matches.push({
      match: match[0],
      specifier,
      names: named.trim(),
      kind,
      local: namespace ?? defaultName ?? '',
    })
  }
  return matches
}

function replaceImport(code: string, parsed: ParsedImport): string {
  const moduleExpr = `__modules.get(${JSON.stringify(parsed.specifier)})`
  if (parsed.kind === 'named') {
    if (!parsed.names) return code.replace(parsed.match, '')
    return code.replace(parsed.match, `const { ${parsed.names} } = ${moduleExpr};`)
  }
  if (parsed.kind === 'namespace') {
    return code.replace(parsed.match, `const ${parsed.local} = ${moduleExpr};`)
  }
  return code.replace(
    parsed.match,
    `const ${parsed.local} = ${moduleExpr}?.default ?? ${moduleExpr};`
  )
}

function replaceImports(code: string, imports: ParsedImport[]): string {
  return imports.reduce((acc, parsed) => replaceImport(acc, parsed), code)
}

export function rewriteImports(code: string): string {
  return replaceImports(code, collectImports(code))
}

export interface BundleResult {
  code: string
  registry: Map<string, object>
}

export function bundle(entryFile: ProjectFile, files: ProjectFile[]): BundleResult {
  const registry = new Map<string, object>()
  registry.set('ai', { ...ai, ai })
  const fileMap = new Map(files.map((file) => [file.name, file]))

  const allImports = new Map<string, ParsedImport[]>()
  const deps = new Map<string, string[]>()

  for (const file of files) {
    const imports = collectImports(file.code)
    if (imports.length > 0) {
      allImports.set(file.name, imports)
      const resolvedDeps: string[] = []
      for (const { specifier } of imports) {
        if (isAiModule(specifier)) continue
        const resolved = resolveFile(specifier, fileMap)
        if (!resolved) {
          throw new Error(
            `Module '${specifier}' not found (imported by '${file.name}'). Create it in the file explorer.`
          )
        }
        resolvedDeps.push(resolved)
      }
      deps.set(file.name, resolvedDeps)
    }
  }

  for (const file of deps.keys()) {
    const cycle = findCircular(file, deps)
    if (cycle) throw new Error(`Circular import detected: '${cycle}'`)
  }

  const fileToSpecifiers = new Map<string, Set<string>>()
  for (const imports of allImports.values()) {
    for (const { specifier } of imports) {
      if (isAiModule(specifier)) continue
      const resolved = resolveFile(specifier, fileMap)!
      if (!fileToSpecifiers.has(resolved)) fileToSpecifiers.set(resolved, new Set())
      fileToSpecifiers.get(resolved)!.add(specifier)
    }
  }

  const visited = new Set<string>()
  const order: string[] = []
  const topoSort = (name: string) => {
    if (visited.has(name)) return
    visited.add(name)
    for (const dep of deps.get(name) || []) topoSort(dep)
    order.push(name)
  }
  for (const file of files) topoSort(file.name)

  for (const fileName of order) {
    if (fileName === entryFile.name) continue
    const file = fileMap.get(fileName)!
    const imports = allImports.get(fileName) || []
    let code = file.code
    if (imports.length > 0) code = replaceImports(code, imports)
    code = guardLoops(code)

    try {
      const exports: Record<string, unknown> = {}
      const module = { exports }
      const args = ['exports', 'module', '__modules']
      const fn = new Function(...args, code)
      fn(exports, module, registry)
      const specifiers = fileToSpecifiers.get(fileName)
      if (specifiers) {
        for (const specifier of specifiers) registry.set(specifier, module.exports)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Error in module '${fileName}': ${message}`)
    }
  }

  const entryImports = allImports.get(entryFile.name) || []
  const rewrittenCode = replaceImports(entryFile.code, entryImports)

  return { code: guardLoops(rewrittenCode) + '\n', registry }
}
