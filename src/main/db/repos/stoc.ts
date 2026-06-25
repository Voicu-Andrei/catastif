import type { Database } from 'better-sqlite3'

// Modifică stocul DOAR pentru produsele care urmăresc stocul (track_stock=1).
// delta > 0 la achiziții, delta < 0 la vânzări.
export function ajusteazaStoc(db: Database, produsId: number | null, delta: number): void {
  if (produsId == null || delta === 0) return
  db.prepare(
    'UPDATE produse SET stoc_curent = stoc_curent + ? WHERE id = ? AND track_stock = 1'
  ).run(delta, produsId)
}
