let fileNames: string[] = []

export function setSandboxFileNames(names: string[]): void {
  fileNames = names
}

export const SANDBOX_LIB = `
declare const time: number;
declare const dt: number;
declare const state: Record<string, any>;
declare const w: number;
declare const h: number;
declare const keys: Record<string, boolean>;
declare const __modules: Map<string, any>;
declare const exports: any;
declare const module: any;
declare const console: {
  log(...data: any[]): void;
  error(...data: any[]): void;
  warn(...data: any[]): void;
  info(...data: any[]): void;
  debug(...data: any[]): void;
};
declare interface Steer { fx: number; fy: number }
declare interface Sense {
  mouse: { x: number; y: number; active: boolean };
  bounds: { x: number; y: number; w: number; h: number };
  time: number;
  w: number;
  h: number;
}
declare interface Agent {
  x: number;
  y: number;
  vx: number;
  vy: number;
  maxSpeed?: number;
  maxForce?: number;
  brain?: (agent: Agent, sense: Sense) => Steer;
  wanderAngle?: number;
}
declare interface FlockOptions {
  perception?: number;
  sep?: number;
  ali?: number;
  coh?: number;
  factor?: number;
  maxForce?: number;
}
declare interface Obstacle { x: number; y: number; r: number }
declare module 'ai' {
  export function agent(opts: Partial<Agent> & { x: number; y: number }): Agent;
  export function think(agent: Agent, sense: Sense, dt: number): Agent;
  export function mouse(): { x: number; y: number; active: boolean };
  export function sense(agent: Agent, w: number, h: number, time?: number): Sense;
  export function neighbors(agents: Agent[], agent: Agent, radius?: number): Agent[];
  export function seek(agent: Agent, tx: number, ty: number, maxForce?: number): Steer;
  export function flee(agent: Agent, tx: number, ty: number, maxForce?: number, radius?: number): Steer;
  export function arrive(agent: Agent, tx: number, ty: number, slowRadius?: number, maxForce?: number): Steer;
  export function pursue(agent: Agent, target: Agent, maxForce?: number): Steer;
  export function evade(agent: Agent, target: Agent, maxForce?: number, radius?: number): Steer;
  export function wander(agent: Agent, maxForce?: number, radius?: number, distance?: number, jitter?: number): Steer;
  export function separate(agent: Agent, neighbors: Agent[], opts?: FlockOptions): Steer;
  export function align(agent: Agent, neighbors: Agent[], opts?: FlockOptions): Steer;
  export function cohesion(agent: Agent, neighbors: Agent[], opts?: FlockOptions): Steer;
  export function flock(agent: Agent, neighbors: Agent[], opts?: FlockOptions): Steer;
  export function avoid(agent: Agent, obstacles: Obstacle[], opts?: FlockOptions & { lookAhead?: number }): Steer;
  export function limitSpeed(agent: Agent, maxSpeed?: number): void;
  export function wrap(agent: Agent, w: number, h: number, margin?: number): void;
  export function keepInBounds(agent: Agent, w: number, h: number, margin?: number, maxForce?: number): Steer;
  const api: {
    agent: typeof agent;
    think: typeof think;
    mouse: typeof mouse;
    sense: typeof sense;
    neighbors: typeof neighbors;
    seek: typeof seek;
    flee: typeof flee;
    arrive: typeof arrive;
    pursue: typeof pursue;
    evade: typeof evade;
    wander: typeof wander;
    separate: typeof separate;
    align: typeof align;
    cohesion: typeof cohesion;
    flock: typeof flock;
    avoid: typeof avoid;
    limitSpeed: typeof limitSpeed;
    wrap: typeof wrap;
    keepInBounds: typeof keepInBounds;
  };
  export { api as ai };
  export default api;
}
`

interface ReturnKeySuggestion {
  label: string
  detail: string
  doc: string
  insertText: string
}

const RETURN_KEYS: ReturnKeySuggestion[] = [
  {
    label: 'particles',
    detail: 'Particle[]',
    doc: 'Array of particles.',
    insertText: "particles: [{ x: 0, y: 0, r: 4, color: '#8B5CF6' }],",
  },
  {
    label: 'lines',
    detail: 'Line[]',
    doc: 'Array of line segments.',
    insertText: 'lines: [{ x1: 0, y1: 0, x2: 0, y2: 0 }],',
  },
  {
    label: 'vectors',
    detail: 'Vector[]',
    doc: 'Array of vector arrows.',
    insertText: 'vectors: [{ x: 0, y: 0, ox: 0, oy: 0 }],',
  },
  {
    label: 'circles',
    detail: 'Circle[]',
    doc: 'Array of circles.',
    insertText: 'circles: [{ cx: 0, cy: 0, r: 10 }],',
  },
  {
    label: 'arcs',
    detail: 'Arc[]',
    doc: 'Array of arcs.',
    insertText: 'arcs: [{ cx: 0, cy: 0, r: 10, startAngle: 0, endAngle: Math.PI * 2 }],',
  },
  {
    label: 'bars',
    detail: 'Bar[]',
    doc: 'Array of bars.',
    insertText: 'bars: [{ x: 0, y: 0, w: 20, h: 40 }],',
  },
  {
    label: 'text',
    detail: 'Record<string, string | number>',
    doc: 'Text overlays keyed by label.',
    insertText: "text: { '': '' },",
  },
]

function inReturnBlock(model: any, position: any): boolean {
  const text = model.getValueInRange({
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  })
  const index = text.lastIndexOf('return {')
  if (index === -1) return false
  return !text.slice(index + 'return {'.length).includes('}')
}

let installed = false

export function getTypeScriptApi(monaco: any): any {
  return monaco.typescript ?? monaco.languages?.typescript
}

export function installSandboxSupport(monaco: any): void {
  if (installed) return
  installed = true

  const typescript = getTypeScriptApi(monaco)
  typescript.javascriptDefaults.addExtraLib(SANDBOX_LIB, 'inmemory://angaza/globals.d.ts')

  monaco.languages.registerCompletionItemProvider('javascript', {
    triggerCharacters: ['.'],
    provideCompletionItems: (model: any, position: any) => {
      const suggestions: any[] = []
      const lineText = model.getLineContent(position.lineNumber)
      const word = model.getWordUntilPosition(position)
      const wordRange = {
        startLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endLineNumber: position.lineNumber,
        endColumn: word.endColumn,
      }

      const fromIndex = lineText.indexOf('from ')
      if (fromIndex !== -1) {
        let quoteIndex = -1
        for (let i = position.column - 2; i >= fromIndex; i--) {
          const char = lineText[i]
          if (char === "'" || char === '"') {
            quoteIndex = i
            break
          }
        }
        if (quoteIndex !== -1) {
          const range = {
            startLineNumber: position.lineNumber,
            startColumn: quoteIndex + 2,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          }
          suggestions.push({
            label: 'ai',
            kind: monaco.languages.CompletionItemKind.Module,
            detail: 'Behavioral AI module',
            insertText: 'ai',
            range,
          })
          for (const name of fileNames) {
            const specifier = name.startsWith('./') ? name : `./${name}`
            suggestions.push({
              label: specifier,
              kind: monaco.languages.CompletionItemKind.File,
              insertText: specifier,
              range,
            })
          }
        }
      }

      if (inReturnBlock(model, position)) {
        for (const key of RETURN_KEYS) {
          suggestions.push({
            label: key.label,
            kind: monaco.languages.CompletionItemKind.Property,
            detail: key.detail,
            documentation: key.doc,
            insertText: key.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: wordRange,
          })
        }
      }

      return { suggestions }
    },
  })
}
