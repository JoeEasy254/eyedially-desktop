import { Moon, Sun } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

type AppTheme = 'light' | 'dark'

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<AppTheme>('light')

  useEffect(() => {
    const saved = window.localStorage.getItem('app-theme')
    const next: AppTheme = saved === 'dark' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-app-theme', next)
  }, [])

  const toggle = useCallback(() => {
    const next: AppTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-app-theme', next)
    window.localStorage.setItem('app-theme', next)
  }, [theme])

  useEffect(() => {
    window.addEventListener('angaza:toggle-theme', toggle)
    return () => window.removeEventListener('angaza:toggle-theme', toggle)
  }, [toggle])

  const label = theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'
  const Icon = theme === 'light' ? Moon : Sun

  return (
    <button
      type="button"
      className={`app-theme-toggle${compact ? ' app-theme-toggle-compact' : ''}`}
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      <Icon size={compact ? 16 : 17} strokeWidth={2.2} />
      {!compact && <span>{theme === 'light' ? 'Dark' : 'Light'}</span>}
    </button>
  )
}
