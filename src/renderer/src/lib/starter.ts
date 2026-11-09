import type { ProjectFile } from '../types/ProjectFile'
import { PRESETS, type Preset } from './presets'

export const STARTER_CODE = `if (!state.init) {
  state.x = 0; state.y = 0;
  state.vx = 80; state.vy = -60;
  state.init = true;
}

state.vy += 200 * dt;
state.x += state.vx * dt;
state.y += state.vy * dt;

const cx = w / 2, cy = h / 2;
const r = Math.min(w, h) * 0.35;

if (state.y > r) { state.y = r; state.vy *= -0.8; }
if (state.y < -r) { state.y = -r; state.vy *= -0.8; }
if (state.x > r || state.x < -r) state.vx *= -1;

return {
  particles: [{ x: cx + state.x, y: cy + state.y, r: 10, color: '#8B5CF6' }],
  circles: [{ cx, cy, r, color: 'rgba(255,255,255,0.08)' }],
  text: { time: time.toFixed(1) + 's' },
}
`

const FLOCKING_CODE = `import ai from 'ai'

if (!state.init) {
  state.init = true
  state.agents = []
  for (let i = 0; i < 55; i++) {
    state.agents.push(ai.agent({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 80,
      vy: (Math.random() - 0.5) * 80,
      maxSpeed: 130,
      maxForce: 160,
    }))
  }
}

const pointer = ai.mouse()

for (const agent of state.agents) {
  const neighbors = ai.neighbors(state.agents, agent, 60)
  const separation = ai.separate(agent, neighbors, { sep: 26 })
  const alignment = ai.align(agent, neighbors)
  const cohesion = ai.cohesion(agent, neighbors)
  const bounds = ai.keepInBounds(agent, w, h, 70, 90)

  let fx = separation.fx * 1.8 + alignment.fx * 0.9 + cohesion.fx * 0.6 + bounds.fx
  let fy = separation.fy * 1.8 + alignment.fy * 0.9 + cohesion.fy * 0.6 + bounds.fy

  if (pointer.active) {
    const seek = ai.seek(agent, pointer.x, pointer.y, 90)
    fx += seek.fx * 0.5
    fy += seek.fy * 0.5
  }

  agent.brain = () => ({ fx, fy })
  ai.think(agent, ai.sense(agent, w, h, time), dt)
  ai.wrap(agent, w, h)
}

const particles = state.agents.map((agent) => {
  const speed = Math.hypot(agent.vx, agent.vy)
  return {
    x: agent.x,
    y: agent.y,
    r: 3 + Math.min(3, speed / 50),
    color: speed > 90 ? '#F59E0B' : '#22D3EE',
  }
})

return {
  particles,
  circles: pointer.active
    ? [{ cx: pointer.x, cy: pointer.y, r: 18, color: 'rgba(245,158,11,0.8)' }]
    : [],
  text: {
    agents: state.agents.length,
    hint: pointer.active ? 'Flocking toward cursor' : 'Move the cursor over the canvas',
  },
}
`

const FLOCKING_PRESET: Preset = {
  id: 'flocking',
  title: 'Flocking AI',
  description: 'Fifty-five agents with separation, alignment, and cohesion. Move the cursor to attract them.',
  code: FLOCKING_CODE,
}

export const EXAMPLES: Preset[] = [
  ...PRESETS.filter((preset) => preset.id !== 'snake'),
  FLOCKING_PRESET,
]

export function createFilesForTemplate(template: string): ProjectFile[] {
  const example = EXAMPLES.find((entry) => entry.id === template)
  return [
    {
      id: 'main',
      name: 'main.js',
      code: example?.code ?? STARTER_CODE,
      isEntry: true,
    },
  ]
}

export function exampleById(id: string): Preset | undefined {
  return EXAMPLES.find((entry) => entry.id === id)
}
