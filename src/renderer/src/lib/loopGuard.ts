import { parse } from '@babel/parser'

export const LOOP_GUARD_LIMIT = 1_000_000
// Kept below the native stack capacity of the instrumented frames (~8k in V8)
// so the friendly error fires before `RangeError: Maximum call stack size exceeded`.
export const RECURSION_DEPTH_LIMIT = 4_000

export const LOOP_GUARD_ERROR =
  `Runaway loop or recursion detected — code stopped to keep the editor responsive (limit: ${LOOP_GUARD_LIMIT.toLocaleString()} steps per frame).`

export const RECURSION_GUARD_ERROR =
  `Runaway recursion detected — code stopped to keep the editor responsive (depth limit: ${RECURSION_DEPTH_LIMIT.toLocaleString()}).`

// Prepended to every compiled file. It resets the shared per-frame budgets
// (steps for loops + function calls, depth for recursion) and (re)defines the
// guard helpers the instrumented code calls. The entry file re-runs this
// prologue every frame, so the budgets start fresh each frame; module files run
// it once at compile time.
const GUARD_PROLOGUE =
  `globalThis.__pvSteps=0;globalThis.__pvDepth=0;` +
  `globalThis.__pvTick=globalThis.__pvTick||function(){if(++globalThis.__pvSteps>${LOOP_GUARD_LIMIT})throw new Error(${JSON.stringify(LOOP_GUARD_ERROR)})};` +
  `globalThis.__pvEnter=globalThis.__pvEnter||function(){if(++globalThis.__pvDepth>${RECURSION_DEPTH_LIMIT})throw new Error(${JSON.stringify(RECURSION_GUARD_ERROR)});globalThis.__pvTick()};` +
  `globalThis.__pvExit=globalThis.__pvExit||function(){globalThis.__pvDepth--};`

const GUARD_CALL = 'globalThis.__pvTick();'
const FUNC_ENTER = 'globalThis.__pvEnter();try{'
const FUNC_EXIT = '}finally{globalThis.__pvExit()}'
const ARROW_OPEN = '{globalThis.__pvEnter();try{return ('
const ARROW_CLOSE = ')}finally{globalThis.__pvExit()}}'

const SKIP_KEYS = new Set([
  'loc',
  'start',
  'end',
  'extra',
  'leadingComments',
  'trailingComments',
  'innerComments',
  'errors',
])

const LOOP_TYPES = new Set([
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
])

// Every function body is instrumented so function calls consume the same
// per-frame step budget as loops (bounds exponential/heavy recursion) and are
// subject to a recursion depth limit (catches infinite recursion with a clear
// error before the native stack overflows).
const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ObjectMethod',
  'ClassMethod',
  'ClassPrivateMethod',
])

interface Insertion {
  offset: number
  text: string
  seq: number
}

// Instruments every loop and function in `code` with a per-frame guard. The
// transformation is parser-driven so it can never corrupt valid code: constructs
// are located by @babel/parser and only pure insertions are applied. If the code
// doesn't parse (it will surface as a normal compile error downstream), the code
// is returned untouched so the author sees the real syntax error.
export function guardLoops(code: string): string {
  let ast: any
  try {
    ast = parse(code, {
      sourceType: 'module',
      allowReturnOutsideFunction: true,
    })
  } catch {
    return code
  }

  const insertions: Insertion[] = []
  let seq = 0

  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return
    const n = node as Record<string, unknown>
    if (LOOP_TYPES.has(n.type as string)) {
      const body = n.body as { type?: string; start?: number; end?: number } | null | undefined
      if (body && typeof body.start === 'number' && typeof body.end === 'number') {
        if (body.type === 'BlockStatement') {
          insertions.push({ offset: body.start + 1, text: GUARD_CALL, seq: seq++ })
        } else {
          // Brace-less body — wrap the single statement so the guard runs every
          // iteration without changing the author's semantics.
          insertions.push({ offset: body.start, text: `{${GUARD_CALL}`, seq: seq++ })
          insertions.push({ offset: body.end, text: '}', seq: seq++ })
        }
      }
    }
    if (FUNCTION_TYPES.has(n.type as string)) {
      const body = n.body as { type?: string; start?: number; end?: number; body?: unknown[] } | null | undefined
      if (body && typeof body.start === 'number' && typeof body.end === 'number') {
        if (body.type === 'BlockStatement') {
          // Empty blocks can't recurse, and start+1 === end-1 would collide.
          if ((body.body?.length ?? 0) > 0) {
            insertions.push({ offset: body.start + 1, text: FUNC_ENTER, seq: seq++ })
            insertions.push({ offset: body.end - 1, text: FUNC_EXIT, seq: seq++ })
          }
        } else {
          // Expression-bodied arrow — wrap so the guard runs and the expression
          // value is preserved. babel's body range excludes the source parens of
          // parenthesized bodies (e.g. `() => ({...})`), so use `extra.parenStart`
          // when present and the arrow node's own `end` as the closing point.
          const extra = (body as any).extra as { parenthesized?: boolean; parenStart?: number } | undefined
          const bodyStart =
            extra?.parenthesized && typeof extra.parenStart === 'number' ? extra.parenStart : body.start
          const bodyEnd = typeof n.end === 'number' ? n.end : body.end
          insertions.push({ offset: bodyStart, text: ARROW_OPEN, seq: seq++ })
          insertions.push({ offset: bodyEnd, text: ARROW_CLOSE, seq: seq++ })
        }
      }
    }
    for (const key of Object.keys(n)) {
      if (SKIP_KEYS.has(key)) continue
      const value = n[key]
      if (Array.isArray(value)) {
        for (const item of value) walk(item)
      } else {
        walk(value)
      }
    }
  }

  walk(ast)

  if (insertions.length === 0) return GUARD_PROLOGUE + code

  // Apply insertions from the end of the file backwards so earlier offsets stay
  // valid. For insertions sharing an offset, children (visited later) must end
  // up before parents — the earlier seq is applied first so the later seq lands
  // in front, producing e.g. `}}` with the inner brace first.
  insertions.sort((a, b) => (b.offset - a.offset) || (a.seq - b.seq))

  let out = code
  for (const ins of insertions) {
    out = out.slice(0, ins.offset) + ins.text + out.slice(ins.offset)
  }
  return GUARD_PROLOGUE + out
}
