export interface Preset {
  id: string
  title: string
  description: string
  code: string
}

export const PRESETS: Preset[] = [
  {
    id: 'circular-orbit',
    title: 'Circular Orbit',
    description: 'A particle orbiting a center point with velocity vector and angle arc.',
    code: `const cx = w / 2, cy = h / 2
const angle = time * 1.5
const r = 120
const px = cx + r * Math.cos(angle)
const py = cy + r * Math.sin(angle)

return {
  particles: [
    { x: px, y: py, r: 10, color: '#8B5CF6', label: 'orbiter' },
    { x: cx, y: cy, r: 6, color: '#F59E0B', label: 'center' },
  ],
  lines: [
    { x1: cx, y1: cy, x2: px, y2: py, color: '#F59E0B', width: 1.5 },
  ],
  circles: [
    { cx, cy, r, color: 'rgba(255,255,255,0.15)' },
  ],
  arcs: [
    { cx, cy, r: 30, startAngle: 0, endAngle: angle % (Math.PI * 2), color: '#8B5CF6', width: 2 },
  ],
  vectors: [
    {
      x: 60 * Math.cos(angle + Math.PI / 2),
      y: 60 * Math.sin(angle + Math.PI / 2),
      ox: px, oy: py, color: '#22C55E', label: 'v',
    },
  ],
  text: {
    theta: (angle % (Math.PI * 2)).toFixed(2) + ' rad',
    x: px.toFixed(0),
    y: py.toFixed(0),
  },
}`,
  },
  {
    id: 'projectile',
    title: 'Projectile Motion',
    description: 'A ball launched at an angle with gravity, showing trajectory trail.',
    code: `if (!state.init) {
  state.init = true
  state.x = 80
  state.y = h - 60
  state.vx = 200
  state.vy = -300
  state.trail = []
}

const g = 400
state.vy += g * dt
state.x += state.vx * dt
state.y += state.vy * dt

if (state.y > h - 20) {
  state.y = h - 20
  state.vy *= -0.6
  state.vx *= 0.8
}

state.trail.push({ x: state.x, y: state.y })
if (state.trail.length > 200) state.trail.shift()

const trailLines = []
for (let i = 1; i < state.trail.length; i++) {
  trailLines.push({
    x1: state.trail[i - 1].x, y1: state.trail[i - 1].y,
    x2: state.trail[i].x, y2: state.trail[i].y,
    color: 'rgba(139,92,246,' + (i / state.trail.length * 0.6) + ')',
    width: 1.5,
  })
}

return {
  particles: [
    { x: state.x, y: state.y, r: 8, color: '#8B5CF6', label: 'ball' },
  ],
  lines: [
    ...trailLines,
    { x1: 0, y1: h - 20, x2: w, y2: h - 20, color: 'rgba(255,255,255,0.1)', width: 1 },
  ],
  vectors: [
    { x: state.vx * 0.2, y: state.vy * 0.2, ox: state.x, oy: state.y, color: '#22C55E', label: 'v' },
  ],
  text: {
    vx: state.vx.toFixed(0) + ' px/s',
    vy: state.vy.toFixed(0) + ' px/s',
    x: state.x.toFixed(0),
    y: state.y.toFixed(0),
  },
}`,
  },
  {
    id: 'spring',
    title: 'Spring Oscillation',
    description: 'A mass on a spring with Hooke\'s law and damping.',
    code: `const cx = w / 2
const restY = h / 2
const k = 200
const damping = 2
const mass = 1

if (!state.init) {
  state.init = true
  state.y = restY - 80
  state.vy = 0
}

const displacement = state.y - restY
const springForce = -k * displacement
const dampingForce = -damping * state.vy
const ay = (springForce + dampingForce) / mass
state.vy += ay * dt
state.y += state.vy * dt

const springTop = 60
const coils = 12
const coilH = (state.y - springTop) / coils
const springLines = []
for (let i = 0; i < coils; i++) {
  const y1 = springTop + i * coilH
  const y2 = springTop + (i + 0.5) * coilH
  const y3 = springTop + (i + 1) * coilH
  springLines.push(
    { x1: cx - 15, y1, x2: cx + 15, y2, color: '#F59E0B', width: 2 },
    { x1: cx + 15, y1: y2, x2: cx - 15, y2: y3, color: '#F59E0B', width: 2 },
  )
}

const energy = 0.5 * k * displacement * displacement + 0.5 * mass * state.vy * state.vy
const pe = 0.5 * k * displacement * displacement
const ke = 0.5 * mass * state.vy * state.vy

return {
  lines: [
    { x1: cx - 40, y1: springTop, x2: cx + 40, y2: springTop, color: '#64748b', width: 3 },
    { x1: cx, y1: restY, x2: cx, y2: restY, color: 'rgba(255,255,255,0.15)', width: 1, dashed: true },
    ...springLines,
  ],
  particles: [
    { x: cx, y: state.y, r: 14, color: '#8B5CF6', label: 'mass' },
  ],
  bars: [
    { x: 30, y: h - 40 - (ke / 500) * 100, w: 35, h: (ke / 500) * 100, color: '#EF4444', label: 'KE' },
    { x: 80, y: h - 40 - (pe / 500) * 100, w: 35, h: (pe / 500) * 100, color: '#3B82F6', label: 'PE' },
  ],
  text: {
    displacement: displacement.toFixed(1) + ' px',
    energy: energy.toFixed(0),
  },
}`,
  },
  {
    id: 'particle-explosion',
    title: 'Particle Explosion',
    description: 'Click to spawn exploding particles with lifetimes.',
    code: `if (!state.init) {
  state.init = true
  state.particles = []
}

if (state.clickX !== undefined) {
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 50 + Math.random() * 200
    state.particles.push({
      x: state.clickX, y: state.clickY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, decay: 0.3 + Math.random() * 0.7,
      r: 2 + Math.random() * 4,
      color: ['#8B5CF6', '#F59E0B', '#EF4444', '#22C55E', '#3B82F6'][Math.floor(Math.random() * 5)],
    })
  }
  state.clickX = undefined
  state.clickY = undefined
}

state.particles = state.particles.filter((p) => {
  p.vy += 100 * dt
  p.x += p.vx * dt
  p.y += p.vy * dt
  p.life -= p.decay * dt
  return p.life > 0
})

return {
  particles: state.particles.map((p) => ({
    x: p.x, y: p.y, r: p.r * p.life, color: p.color,
  })),
  lines: [
    { x1: 0, y1: h - 20, x2: w, y2: h - 20, color: 'rgba(255,255,255,0.1)', width: 1 },
  ],
  text: {
    particles: state.particles.length,
    hint: 'Click to explode!',
  },
}`,
  },
  {
    id: 'energy-bars',
    title: 'Energy Conservation',
    description: 'A ball rolling on a sinusoidal track exchanging kinetic and potential energy.',
    code: `const groundY = h - 80
const trackAmp = 60
const trackFreq = 0.015

function trackY(x) {
  return groundY - trackAmp * Math.sin(trackFreq * x)
}

if (!state.init) {
  state.init = true
  state.x = 50
  state.vx = 120
  state.trail = []
}

const slope = trackAmp * trackFreq * Math.cos(trackFreq * state.x) * trackAmp * trackFreq * Math.cos(trackFreq * state.x)
const g = 300
state.vx += g * slope * dt * 0.001
state.x += state.vx * dt
state.trail.push({ x: state.x, y: trackY(state.x) })
if (state.trail.length > 300) state.trail.shift()

const py = trackY(state.x)
const baseY = groundY
const KE = 0.5 * state.vx * state.vx * 0.01
const PE = (baseY - py) * 0.5
const total = KE + PE

const trailLines = state.trail.map((p, i) => {
  if (i === 0) return null
  return {
    x1: state.trail[i - 1].x, y1: state.trail[i - 1].y,
    x2: p.x, y2: p.y,
    color: 'rgba(139,92,246,' + (i / state.trail.length * 0.5) + ')',
    width: 1.5,
  }
}).filter(Boolean)

const trackLines = []
for (let x = 0; x < w; x += 4) {
  const ty = trackY(x)
  const ty2 = trackY(x + 4)
  trackLines.push({
    x1: x, y1: ty, x2: x + 4, y2: ty2,
    color: 'rgba(255,255,255,0.12)', width: 1,
  })
}

return {
  lines: [...trackLines, ...trailLines],
  particles: [
    { x: state.x, y: py, r: 10, color: '#8B5CF6', label: 'ball' },
  ],
  bars: [
    { x: 20, y: h - 30 - KE, w: 40, h: KE, color: '#EF4444', label: 'KE', value: Math.round(KE) },
    { x: 80, y: h - 30 - PE, w: 40, h: PE, color: '#3B82F6', label: 'PE', value: Math.round(PE) },
    { x: 140, y: h - 30 - total, w: 40, h: total, color: '#22C55E', label: 'Total', value: Math.round(total) },
  ],
  text: {
    x: state.x.toFixed(0),
    vx: state.vx.toFixed(0),
  },
}`,
  },
  {
    id: 'trig-projections',
    title: 'Trig Projections',
    description: 'Unit circle with sine/cosine projections and angle sweep.',
    code: `const cx = 160, cy = h / 2
const r = 100
const angle = time * 0.8
const px = cx + r * Math.cos(angle)
const py = cy - r * Math.sin(angle)

return {
  particles: [
    { x: px, y: py, r: 7, color: '#8B5CF6', label: 'P' },
  ],
  circles: [
    { cx, cy, r, color: 'rgba(255,255,255,0.12)' },
  ],
  lines: [
    { x1: cx, y1: cy, x2: px, y2: py, color: '#F59E0B', width: 1.5 },
    { x1: px, y1: py, x2: px, y2: cy, color: '#EF4444', width: 1, dashed: true },
    { x1: px, y1: py, x2: cx, y2: py, color: '#3B82F6', width: 1, dashed: true },
    { x1: cx - r - 20, y1: cy, x2: cx + r + 20, y2: cy, color: 'rgba(255,255,255,0.08)', width: 1 },
    { x1: cx, y1: cy - r - 20, x2: cx, y2: cy + r + 20, color: 'rgba(255,255,255,0.08)', width: 1 },
  ],
  arcs: [
    { cx, cy, r: 25, startAngle: 0, endAngle: angle % (Math.PI * 2), color: '#8B5CF6', width: 2 },
  ],
  bars: [
    { x: cx + r + 40, y: cy - Math.abs(Math.sin(angle)) * r, w: 30, h: Math.abs(Math.sin(angle)) * r, color: '#EF4444', label: 'sin' },
    { x: cx + r + 80, y: cy - Math.abs(Math.cos(angle)) * r, w: 30, h: Math.abs(Math.cos(angle)) * r, color: '#3B82F6', label: 'cos' },
  ],
  text: {
    angle: ((angle % (Math.PI * 2)) * 180 / Math.PI).toFixed(1) + '°',
    sin: Math.sin(angle).toFixed(3),
    cos: Math.cos(angle).toFixed(3),
  },
}`,
  },
  {
    id: 'collision',
    title: '2D Collision',
    description: 'Two circles with elastic collision detection and response.',
    code: `if (!state.init) {
  state.init = true
  state.p1 = { x: 150, y: h / 2, vx: 120, vy: 0, r: 30, mass: 1, color: '#8B5CF6' }
  state.p2 = { x: w - 150, y: h / 2, vx: -80, vy: 0, r: 20, mass: 0.5, color: '#EF4444' }
}

const p1 = state.p1, p2 = state.p2
p1.x += p1.vx * dt
p1.y += p1.vy * dt
p2.x += p2.vx * dt
p2.y += p2.vy * dt

if (p1.x < p1.r) { p1.x = p1.r; p1.vx *= -1 }
if (p1.x > w - p1.r) { p1.x = w - p1.r; p1.vx *= -1 }
if (p1.y < p1.r) { p1.y = p1.r; p1.vy *= -1 }
if (p1.y > h - p1.r) { p1.y = h - p1.r; p1.vy *= -1 }

if (p2.x < p2.r) { p2.x = p2.r; p2.vx *= -1 }
if (p2.x > w - p2.r) { p2.x = w - p2.r; p2.vx *= -1 }
if (p2.y < p2.r) { p2.y = p2.r; p2.vy *= -1 }
if (p2.y > h - p2.r) { p2.y = h - p2.r; p2.vy *= -1 }

const dx = p2.x - p1.x, dy = p2.y - p1.y
const dist = Math.sqrt(dx * dx + dy * dy)
const minDist = p1.r + p2.r
let colliding = false

if (dist < minDist && dist > 0) {
  colliding = true
  const nx = dx / dist, ny = dy / dist
  const dvx = p1.vx - p2.vx, dvy = p1.vy - p2.vy
  const dvn = dvx * nx + dvy * ny
  if (dvn > 0) {
    const impulse = (2 * dvn) / (p1.mass + p2.mass)
    p1.vx -= impulse * p2.mass * nx
    p1.vy -= impulse * p2.mass * ny
    p2.vx += impulse * p1.mass * nx
    p2.vy += impulse * p1.mass * ny
  }
  const overlap = minDist - dist
  p1.x -= overlap * 0.5 * nx
  p1.y -= overlap * 0.5 * ny
  p2.x += overlap * 0.5 * nx
  p2.y += overlap * 0.5 * ny
}

return {
  particles: [
    { x: p1.x, y: p1.y, r: p1.r, color: colliding ? '#F59E0B' : p1.color, label: 'm1' },
    { x: p2.x, y: p2.y, r: p2.r, color: colliding ? '#F59E0B' : p2.color, label: 'm2' },
  ],
  vectors: [
    { x: p1.vx * 0.3, y: p1.vy * 0.3, ox: p1.x, oy: p1.y, color: '#22C55E' },
    { x: p2.vx * 0.3, y: p2.vy * 0.3, ox: p2.x, oy: p2.y, color: '#22C55E' },
  ],
  text: {
    p1_speed: Math.hypot(p1.vx, p1.vy).toFixed(0),
    p2_speed: Math.hypot(p2.vx, p2.vy).toFixed(0),
    collision: colliding ? 'YES' : 'no',
  },
}`,
  },
  {
    id: 'snake',
    title: 'Snake Game',
    description: 'Classic Snake game controlled with arrow keys or WASD. Press R to restart.',
    code: `if (!state.init) {
  state.cell = 20;
  state.cols = Math.floor(w / state.cell);
  state.rows = Math.floor(h / state.cell);
  state.snake = [
    { x: 8, y: 8 },
    { x: 7, y: 8 },
    { x: 6, y: 8 }
  ];
  state.dir = { x: 1, y: 0 };
  state.nextDir = { x: 1, y: 0 };
  state.food = { x: 15, y: 10 };
  state.score = 0;
  state.timer = 0;
  state.speed = 0.12;
  state.gameOver = false;
  state.init = true;
}

if (!state.gameOver) {
  if ((keys.ArrowUp || keys.w) && state.dir.y !== 1)
    state.nextDir = { x: 0, y: -1 };
  if ((keys.ArrowDown || keys.s) && state.dir.y !== -1)
    state.nextDir = { x: 0, y: 1 };
  if ((keys.ArrowLeft || keys.a) && state.dir.x !== 1)
    state.nextDir = { x: -1, y: 0 };
  if ((keys.ArrowRight || keys.d) && state.dir.x !== -1)
    state.nextDir = { x: 1, y: 0 };
}

if (!state.gameOver) {
  state.timer += dt;
  if (state.timer >= state.speed) {
    state.timer = 0;
    state.dir = state.nextDir;
    const head = state.snake[0];
    const newHead = { x: head.x + state.dir.x, y: head.y + state.dir.y };
    if (newHead.x < 0 || newHead.x >= state.cols || newHead.y < 0 || newHead.y >= state.rows) {
      state.gameOver = true;
    }
    for (const s of state.snake) {
      if (s.x === newHead.x && s.y === newHead.y) state.gameOver = true;
    }
    if (!state.gameOver) {
      state.snake.unshift(newHead);
      if (newHead.x === state.food.x && newHead.y === state.food.y) {
        state.score++;
        state.speed = Math.max(0.05, state.speed * 0.98);
        while (true) {
          const fx = Math.floor(Math.random() * state.cols);
          const fy = Math.floor(Math.random() * state.rows);
          let occupied = false;
          for (const s of state.snake) { if (s.x === fx && s.y === fy) { occupied = true; break; } }
          if (!occupied) { state.food = { x: fx, y: fy }; break; }
        }
      } else {
        state.snake.pop();
      }
    }
  }
}

const particles = [];
for (const s of state.snake) {
  particles.push({ x: s.x * state.cell + state.cell / 2, y: s.y * state.cell + state.cell / 2, r: state.cell * 0.42, color: "#22C55E" });
}
particles.push({ x: state.food.x * state.cell + state.cell / 2, y: state.food.y * state.cell + state.cell / 2, r: state.cell * 0.42, color: "#EF4444" });
particles.push({ x: state.snake[0].x * state.cell + state.cell / 2, y: state.snake[0].y * state.cell + state.cell / 2, r: state.cell * 0.45, color: "#4ADE80" });

const text = { Score: String(state.score) };
if (state.gameOver) {
  text["GAME OVER"] = "Press R to Restart";
  if (keys.r || keys.R) state.init = false;
}

return { particles, text };`,
  },
]
