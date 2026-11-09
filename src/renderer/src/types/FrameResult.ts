export interface FrameResult {
  particles?: Array<{
    x: number
    y: number
    z?: number
    r?: number
    color?: string
    label?: string
  }>

  lines?: Array<{
    x1: number
    y1: number
    x2: number
    y2: number
    color?: string
    dashed?: boolean
    width?: number
  }>

  vectors?: Array<{
    x: number
    y: number
    ox?: number
    oy?: number
    color?: string
    label?: string
  }>

  circles?: Array<{
    cx: number
    cy: number
    r: number
    color?: string
    fill?: string
  }>

  arcs?: Array<{
    cx: number
    cy: number
    r: number
    startAngle: number
    endAngle: number
    color?: string
    width?: number
  }>

  bars?: Array<{
    x: number
    y: number
    w: number
    h: number
    color?: string
    label?: string
    value?: number
  }>

  text?: Record<string, string | number>
}
