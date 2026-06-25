import type { CatastifApi } from '@shared/types'

declare global {
  interface Window {
    api: CatastifApi
  }
}

export {}
