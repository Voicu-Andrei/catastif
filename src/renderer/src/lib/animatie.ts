import type { CSSProperties } from 'react'

// Ajutoare pentru animațiile de intrare.
//
// Decalajul („stagger”) se plafonează dinadins: pe o listă cu două mii de
// rânduri, un decalaj crescător la nesfârșit ar face ultimele rânduri să apară
// după un minut. După primele câteva, totul intră deodată.

const MAX_DECALAJ = 10

// Se pune ca `style` pe element, împreună cu clasa `apare` sau `apare-lin`.
export function decalaj(index: number, maxim = MAX_DECALAJ): CSSProperties {
  return { ['--i' as string]: Math.min(index, maxim) }
}
