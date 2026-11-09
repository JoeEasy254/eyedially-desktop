import { useCallback, useEffect, useRef, useState } from 'react'
import type { FrameResult } from '../types/FrameResult'
import type { ProjectFile } from '../types/ProjectFile'
import { bundle } from '../lib/bundler'

export function useLiveCode(
  files: ProjectFile[],
  keysRef?: { current: Record<string, boolean> }
) {
  const compiledRef = useRef<Function | null>(null)
  const registryRef = useRef<Map<string, object>>(new Map())
  const stateRef = useRef<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const timeRef = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const entry = files.find((file) => file.isEntry)
        if (!entry) {
          setError('No entry file found')
          return
        }
        const { code, registry } = bundle(entry, files)
        registryRef.current = registry
        compiledRef.current = new Function(
          'time',
          'dt',
          'state',
          'w',
          'h',
          'keys',
          '__modules',
          `"use strict"; return (() => { ${code}\n })()`
        )
        stateRef.current = {}
        timeRef.current = 0
        setError(null)
      } catch (caught) {
        compiledRef.current = null
        setError(caught instanceof Error ? caught.message : 'Compile error')
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [files])

  const frame = useCallback((_time: number, dt: number, w: number, h: number): FrameResult | null => {
    if (!compiledRef.current) return null
    try {
      timeRef.current += dt
      const result = compiledRef.current(
        timeRef.current,
        dt,
        stateRef.current,
        w,
        h,
        keysRef?.current ?? {},
        registryRef.current
      )
      setError(null)
      return result as FrameResult
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Runtime error')
      return null
    }
  }, [keysRef])

  const handleCanvasClick = useCallback((x: number, y: number) => {
    stateRef.current.clickX = x
    stateRef.current.clickY = y
  }, [])

  const restart = useCallback(() => {
    stateRef.current = {}
    timeRef.current = 0
    setError(null)
  }, [])

  const togglePause = useCallback(() => {
    setPaused((value) => !value)
  }, [])

  const getState = useCallback(() => stateRef.current, [])

  return { frame, error, paused, restart, togglePause, setPaused, handleCanvasClick, getState }
}
