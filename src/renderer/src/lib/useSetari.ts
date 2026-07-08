import { useEffect, useState } from 'react'
import type { Setari } from '@shared/types'

// Setările se schimbă rar: le încărcăm o dată pe sesiune și le păstrăm în
// memorie. Ecranul de Setări cheamă invalidateSetari() după salvare.

let cache: Setari | null = null

export function useSetari(): Setari | null {
  const [setari, setSetari] = useState<Setari | null>(cache)

  useEffect(() => {
    if (cache) return
    let activ = true
    window.api.setari
      .get()
      .then((s) => {
        cache = s
        if (activ) setSetari(s)
      })
      .catch(() => {
        // fără setări rămân valorile implicite din formulare
      })
    return () => {
      activ = false
    }
  }, [])

  return setari
}

export function invalidateSetari(): void {
  cache = null
}
