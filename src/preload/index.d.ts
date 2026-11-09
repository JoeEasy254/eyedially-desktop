import type { AngazaApi } from '../shared/api'

declare global {
  interface Window {
    angaza: AngazaApi
  }
}

export {}
