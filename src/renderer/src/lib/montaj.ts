import type { StareMontaj } from '@shared/types'

// Fiind un Record<StareMontaj, ...>, compilatorul cere actualizarea acestui
// obiect dacă tipul se extinde vreodată — exact plasa de siguranță care lipsește
// la `stare`, unde valorile sunt literale SQL invizibile pentru type-checker.
export const MONTAJ_META: Record<StareMontaj, { label: string; color: string }> = {
  nespecificat: { label: '—', color: 'gray' },
  neprogramat: { label: 'Neprogramat', color: 'gray' },
  programat: { label: 'Programat', color: 'blue' },
  intarziat: { label: 'Întârziat', color: 'red' },
  montat: { label: 'Montat', color: 'teal' }
}
