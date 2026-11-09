import { describe, expect, it } from 'vitest'
import { SampleRecorder, parseNumber } from '../src/renderer/src/lib/analyzer'

describe('parseNumber', () => {
  it('parses numeric strings and ignores units', () => {
    expect(parseNumber('12.5 m/s')).toBe(12.5)
    expect(parseNumber('-3.2e2')).toBe(-320)
    expect(parseNumber(7)).toBe(7)
  })

  it('returns null for non-numeric text', () => {
    expect(parseNumber('idle')).toBeNull()
    expect(parseNumber(Number.NaN)).toBeNull()
  })
})

describe('SampleRecorder', () => {
  it('keeps the newest samples when the ring buffer is full', () => {
    const recorder = new SampleRecorder(3)
    for (let index = 0; index < 5; index++) {
      recorder.push(index, { energy: index })
    }

    expect(recorder.keys()).toEqual(['energy'])
    expect(recorder.series('energy').map((point) => point.v)).toEqual([2, 3, 4])
    expect(recorder.bounds('energy')).toEqual({ min: 2, max: 4, latest: 4 })
  })

  it('ignores samples without numeric values', () => {
    const recorder = new SampleRecorder(4)
    recorder.push(0, {})
    recorder.push(1, { speed: 5 })
    recorder.push(2, { speed: 9 })

    expect(recorder.series('speed')).toHaveLength(2)
  })

  it('downsamples long series while retaining all points for short ones', () => {
    const recorder = new SampleRecorder(300)
    for (let index = 0; index < 300; index++) recorder.push(index, { value: index })

    expect(recorder.downsampled('value')).toHaveLength(120)
    expect(recorder.downsampled('value')[0].t).toBe(0)
  })

  it('resets all samples', () => {
    const recorder = new SampleRecorder(4)
    recorder.push(1, { x: 1 })
    recorder.reset()

    expect(recorder.keys()).toEqual([])
    expect(recorder.bounds('x')).toEqual({ min: 0, max: 1, latest: null })
  })
})
