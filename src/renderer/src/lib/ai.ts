export interface Steer {
  fx: number
  fy: number
}

export interface Sense {
  mouse: { x: number; y: number; active: boolean }
  bounds: { x: number; y: number; w: number; h: number }
  time: number
  w: number
  h: number
}

export interface Agent {
  x: number
  y: number
  vx: number
  vy: number
  maxSpeed?: number
  maxForce?: number
  brain?: (agent: Agent, sense: Sense) => Steer
  wanderAngle?: number
}

const mousePos = { x: 0, y: 0, active: false }

export function setAiMouse(x: number, y: number): void {
  mousePos.x = x
  mousePos.y = y
  mousePos.active = true
}

export function setAiMouseLeave(): void {
  mousePos.active = false
}

function truncate(x: number, y: number, max: number): Steer {
  const m = Math.hypot(x, y)
  if (m === 0) return { fx: 0, fy: 0 }
  if (m > max) return { fx: (x / m) * max, fy: (y / m) * max }
  return { fx: x, fy: y }
}

export function mouse(): { x: number; y: number; active: boolean } {
  return { x: mousePos.x, y: mousePos.y, active: mousePos.active }
}

export function sense(agent: Agent, w: number, h: number, time = 0): Sense {
  return {
    mouse: { x: mousePos.x, y: mousePos.y, active: mousePos.active },
    bounds: { x: 0, y: 0, w, h },
    time,
    w,
    h,
  }
}

export function neighbors(agents: Agent[], agent: Agent, radius = 60): Agent[] {
  const r2 = radius * radius
  const out: Agent[] = []
  for (const other of agents) {
    if (other === agent) continue
    const dx = other.x - agent.x
    const dy = other.y - agent.y
    if (dx * dx + dy * dy <= r2) out.push(other)
  }
  return out
}

export function agent(opts: Partial<Agent> & { x: number; y: number }): Agent {
  return {
    x: opts.x,
    y: opts.y,
    vx: opts.vx ?? 0,
    vy: opts.vy ?? 0,
    maxSpeed: opts.maxSpeed ?? 100,
    maxForce: opts.maxForce ?? 60,
    brain: opts.brain,
  }
}

export function think(agent: Agent, sense: Sense, dt: number): Agent {
  if (!agent.brain) return agent
  const force = agent.brain(agent, sense) ?? { fx: 0, fy: 0 }
  const clamped = truncate(force.fx, force.fy, agent.maxForce ?? 60)
  agent.vx += clamped.fx * dt
  agent.vy += clamped.fy * dt
  limitSpeed(agent, agent.maxSpeed ?? 100)
  agent.x += agent.vx * dt
  agent.y += agent.vy * dt
  return agent
}

export function limitSpeed(agent: Agent, maxSpeed = 100): void {
  const spd = Math.hypot(agent.vx, agent.vy)
  if (spd > maxSpeed) {
    agent.vx = (agent.vx / spd) * maxSpeed
    agent.vy = (agent.vy / spd) * maxSpeed
  }
}

export function wrap(agent: Agent, w: number, h: number, margin = 0): void {
  if (agent.x < -margin) agent.x = w + margin
  if (agent.x > w + margin) agent.x = -margin
  if (agent.y < -margin) agent.y = h + margin
  if (agent.y > h + margin) agent.y = -margin
}

export function keepInBounds(agent: Agent, w: number, h: number, margin = 40, maxForce = 60): Steer {
  let fx = 0
  let fy = 0
  if (agent.x < margin) fx = 1
  else if (agent.x > w - margin) fx = -1
  if (agent.y < margin) fy = 1
  else if (agent.y > h - margin) fy = -1
  return { fx: fx * maxForce, fy: fy * maxForce }
}

export function seek(agent: Agent, tx: number, ty: number, maxForce = 60): Steer {
  return truncate(tx - agent.x, ty - agent.y, maxForce)
}

export function flee(agent: Agent, tx: number, ty: number, maxForce = 60, radius = Infinity): Steer {
  const dx = agent.x - tx
  const dy = agent.y - ty
  const d = Math.hypot(dx, dy)
  if (d > radius) return { fx: 0, fy: 0 }
  return truncate(dx, dy, maxForce)
}

export function arrive(agent: Agent, tx: number, ty: number, slowRadius = 80, maxForce = 60): Steer {
  const dx = tx - agent.x
  const dy = ty - agent.y
  const d = Math.hypot(dx, dy)
  if (d < 1) return { fx: 0, fy: 0 }
  const mag = d < slowRadius ? maxForce * (d / slowRadius) : maxForce
  return truncate(dx, dy, mag)
}

export function pursue(agent: Agent, target: Agent, maxForce = 60): Steer {
  const dist = Math.hypot(target.x - agent.x, target.y - agent.y)
  const t = dist / Math.max(agent.maxSpeed ?? 100, 1)
  return seek(agent, target.x + target.vx * t, target.y + target.vy * t, maxForce)
}

export function evade(agent: Agent, target: Agent, maxForce = 60, radius = Infinity): Steer {
  const dist = Math.hypot(target.x - agent.x, target.y - agent.y)
  const t = dist / Math.max(agent.maxSpeed ?? 100, 1)
  return flee(agent, target.x + target.vx * t, target.y + target.vy * t, maxForce, radius)
}

export function wander(agent: Agent, maxForce = 30, radius = 40, distance = 80, jitter = 0.4): Steer {
  if (agent.wanderAngle === undefined) agent.wanderAngle = Math.random() * Math.PI * 2
  const spd = Math.hypot(agent.vx, agent.vy) || 1
  const dirX = agent.vx / spd
  const dirY = agent.vy / spd
  const cx = agent.x + dirX * distance
  const cy = agent.y + dirY * distance
  agent.wanderAngle += (Math.random() - 0.5) * jitter * 2 * Math.PI
  const tx = cx + Math.cos(agent.wanderAngle) * radius
  const ty = cy + Math.sin(agent.wanderAngle) * radius
  return truncate(tx - agent.x, ty - agent.y, maxForce)
}

export interface FlockOptions {
  perception?: number
  sep?: number
  ali?: number
  coh?: number
  factor?: number
  maxForce?: number
}

export function separate(agent: Agent, neighbors: Agent[], opts: FlockOptions = {}): Steer {
  const perception = opts.perception ?? 60
  const factor = opts.factor ?? 1.5
  const maxForce = opts.maxForce ?? 60
  let sx = 0
  let sy = 0
  let count = 0
  for (const other of neighbors) {
    if (other === agent) continue
    const dx = agent.x - other.x
    const dy = agent.y - other.y
    const d = Math.hypot(dx, dy)
    if (d > 0 && d < perception) {
      sx += dx / d
      sy += dy / d
      count++
    }
  }
  if (count === 0) return { fx: 0, fy: 0 }
  return truncate((sx / count) * factor, (sy / count) * factor, maxForce)
}

export function align(agent: Agent, neighbors: Agent[], opts: FlockOptions = {}): Steer {
  const factor = opts.factor ?? 1
  const maxForce = opts.maxForce ?? 60
  let ax = 0
  let ay = 0
  let count = 0
  for (const other of neighbors) {
    if (other === agent) continue
    ax += other.vx
    ay += other.vy
    count++
  }
  if (count === 0) return { fx: 0, fy: 0 }
  const avgVx = ax / count
  const avgVy = ay / count
  return truncate((avgVx - agent.vx) * factor, (avgVy - agent.vy) * factor, maxForce)
}

export function cohesion(agent: Agent, neighbors: Agent[], opts: FlockOptions = {}): Steer {
  const factor = opts.factor ?? 1
  const maxForce = opts.maxForce ?? 60
  let cx = 0
  let cy = 0
  let count = 0
  for (const other of neighbors) {
    if (other === agent) continue
    cx += other.x
    cy += other.y
    count++
  }
  if (count === 0) return { fx: 0, fy: 0 }
  const avgX = cx / count
  const avgY = cy / count
  return truncate((avgX - agent.x) * factor, (avgY - agent.y) * factor, maxForce)
}

export function flock(agent: Agent, neighbors: Agent[], opts: FlockOptions = {}): Steer {
  const perception = opts.perception ?? 60
  const maxForce = opts.maxForce ?? 60
  const s = separate(agent, neighbors, { perception, factor: opts.sep ?? 1.5, maxForce })
  const a = align(agent, neighbors, { factor: opts.ali ?? 1, maxForce })
  const c = cohesion(agent, neighbors, { factor: opts.coh ?? 1, maxForce })
  return truncate(s.fx + a.fx + c.fx, s.fy + a.fy + c.fy, maxForce)
}

export interface Obstacle {
  x: number
  y: number
  r: number
}

export function avoid(agent: Agent, obstacles: Obstacle[], opts: FlockOptions & { lookAhead?: number } = {}): Steer {
  const radius = opts.perception ?? 60
  const lookAhead = opts.lookAhead ?? 60
  const maxForce = opts.maxForce ?? 80
  const spd = Math.hypot(agent.vx, agent.vy) || 1
  const ux = agent.vx / spd
  const uy = agent.vy / spd
  const px = agent.x + ux * lookAhead
  const py = agent.y + uy * lookAhead
  let bx = 0
  let by = 0
  let found = false
  let bestD = Infinity
  for (const ob of obstacles) {
    const d = Math.hypot(px - ob.x, py - ob.y)
    if (d < ob.r + radius && d < bestD) {
      bx = ob.x
      by = ob.y
      bestD = d
      found = true
    }
  }
  if (!found) return { fx: 0, fy: 0 }
  const ox = px - bx
  const oy = py - by
  const od = Math.hypot(ox, oy) || 1
  return truncate((ox / od) * maxForce, (oy / od) * maxForce, maxForce)
}

export const ai = {
  agent,
  think,
  mouse,
  sense,
  neighbors,
  seek,
  flee,
  arrive,
  pursue,
  evade,
  wander,
  separate,
  align,
  cohesion,
  flock,
  avoid,
  limitSpeed,
  wrap,
  keepInBounds,
}
