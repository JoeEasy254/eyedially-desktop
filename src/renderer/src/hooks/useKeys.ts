import { useRef, useEffect, useCallback } from 'react'

export function useKeys(focusedRef?: { current: boolean }) {
  const keysRef = useRef<Record<string, boolean>>({})

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    keysRef.current[e.key] = true
    if (focusedRef?.current) {
      e.preventDefault()
    }
  }, [focusedRef])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    keysRef.current[e.key] = false
  }, [])

  const handleBlur = useCallback(() => {
    keysRef.current = {}
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [handleKeyDown, handleKeyUp, handleBlur])

  return keysRef
}
