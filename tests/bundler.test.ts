import { describe, expect, it } from 'vitest'
import type { ProjectFile } from '../src/renderer/src/types/ProjectFile'
import { bundle, rewriteImports } from '../src/renderer/src/lib/bundler'
import { EXAMPLES, STARTER_CODE, createFilesForTemplate } from '../src/renderer/src/lib/starter'

function file(id: string, name: string, code: string, isEntry = false): ProjectFile {
  return { id, name, code, isEntry }
}

function compileAndRun(files: ProjectFile[], frames = 3): unknown[] {
  const entry = files.find((candidate) => candidate.isEntry)
  if (!entry) throw new Error('missing entry')
  const { code, registry } = bundle(entry, files)
  const state: Record<string, unknown> = {}
  const frame = new Function(
    'time',
    'dt',
    'state',
    'w',
    'h',
    'keys',
    '__modules',
    `"use strict"; return (() => { ${code}\n })()`
  )

  const results: unknown[] = []
  for (let index = 0; index < frames; index++) {
    results.push(frame(index / 60, 1 / 60, state, 640, 360, {}, registry))
  }
  return results
}

describe('rewriteImports', () => {
  it('rewrites default, named, and namespace imports', () => {
    const code = [
      "import ai from 'ai'",
      "import { helper, other as alias } from './helper.js'",
      "import * as utils from './utils'",
    ].join('\n')

    expect(rewriteImports(code)).toBe(
      [
        'const ai = __modules.get("ai")?.default ?? __modules.get("ai");',
        'const { helper, other as alias } = __modules.get("./helper.js");',
        'const utils = __modules.get("./utils");',
      ].join('\n')
    )
  })
})

describe('bundle', () => {
  it('executes local modules and exposes their exports to the entry file', () => {
    const files = [
      file(
        'file-1',
        'helper.js',
        `exports.double = function (value) { return value * 2 }\n`
      ),
      file(
        'file-2',
        'main.js',
        `import { double } from './helper.js'\nreturn { text: { value: double(21) } }\n`,
        true
      ),
    ]

    const results = compileAndRun(files, 1) as Array<{ text: { value: number } }>
    expect(results[0].text.value).toBe(42)
  })

  it('resolves extensionless import specifiers', () => {
    const files = [
      file('file-1', 'math.js', 'exports.answer = 42\n'),
      file('file-2', 'main.js', "import { answer } from './math'\nreturn { text: { answer } }\n", true),
    ]

    const results = compileAndRun(files, 1) as Array<{ text: { answer: number } }>
    expect(results[0].text.answer).toBe(42)
  })

  it('reports missing modules', () => {
    const files = [
      file('file-1', 'main.js', "import { nope } from './missing.js'\nreturn {}\n", true),
    ]
    expect(() => compileAndRun(files, 1)).toThrow(/Module '\.\/missing\.js' not found/)
  })

  it('detects circular imports', () => {
    const files = [
      file('file-1', 'a.js', "import { b } from './b.js'\nexports.a = b\n"),
      file('file-2', 'b.js', "import { a } from './a.js'\nexports.b = a\n"),
      file('file-3', 'main.js', "import './a.js'\nreturn {}\n", true),
    ]
    expect(() => compileAndRun(files, 1)).toThrow(/Circular import detected/)
  })

  it('runs the AI module inside user code', () => {
    const files = createFilesForTemplate('flocking')
    const results = compileAndRun(files, 3) as Array<{
      particles: unknown[]
      text?: Record<string, unknown>
    }>

    expect(results).toHaveLength(3)
    expect(results[2].particles.length).toBe(55)
    expect(results[2].text?.agents).toBe(55)
  })

  it.each([['blank' as const], ...EXAMPLES.map((example) => [example.id] as const)])(
    'compiles and runs template %s',
    (template) => {
      const files = createFilesForTemplate(template)
      const results = compileAndRun(files, 4) as Array<Record<string, unknown>>
      expect(results).toHaveLength(4)
      expect(results[3]).toBeTypeOf('object')
      expect(results[3]).not.toBeNull()
    }
  )

  it('compiles the starter code directly', () => {
    const results = compileAndRun(
      [file('main', 'main.js', STARTER_CODE, true)],
      2
    ) as Array<{ particles: unknown[] }>
    expect(results[1].particles).toHaveLength(1)
  })
})
