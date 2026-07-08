import { getDb } from '../connection'
import type { SearchResult } from '@shared/types'

export function searchGlobal(q: string): SearchResult[] {
  const t = q.trim()
  if (t.length < 2) return []
  const db = getDb()
  const like = `%${t.replace(/[\\%_]/g, (c) => '\\' + c)}%`
  const out: SearchResult[] = []

  for (const p of db
    .prepare("SELECT id, nume FROM produse WHERE nume LIKE ? ESCAPE '\\' ORDER BY nume LIMIT 6")
    .all(like) as { id: number; nume: string }[]) {
    out.push({
      tip: 'produs',
      id: p.id,
      titlu: p.nume,
      subtitlu: 'Produs',
      link: `/produse?edit=${p.id}`
    })
  }

  for (const c of db
    .prepare(
      `SELECT id, nume, COALESCE(cui, cnp, '') AS cod FROM clienti
       WHERE nume LIKE ? ESCAPE '\\' OR cui LIKE ? ESCAPE '\\' OR cnp LIKE ? ESCAPE '\\'
       ORDER BY nume LIMIT 6`
    )
    .all(like, like, like) as { id: number; nume: string; cod: string }[]) {
    out.push({
      tip: 'client',
      id: c.id,
      titlu: c.nume,
      subtitlu: c.cod || 'Client',
      link: `/clienti?edit=${c.id}`
    })
  }

  for (const f of db
    .prepare(
      "SELECT id, nume FROM furnizori WHERE nume LIKE ? ESCAPE '\\' OR cui LIKE ? ESCAPE '\\' ORDER BY nume LIMIT 6"
    )
    .all(like, like) as { id: number; nume: string }[]) {
    out.push({
      tip: 'furnizor',
      id: f.id,
      titlu: f.nume,
      subtitlu: 'Furnizor',
      link: `/furnizori?edit=${f.id}`
    })
  }

  for (const o of db
    .prepare(
      `SELECT c.id, c.numar, cl.nume AS client_nume
       FROM comenzi c LEFT JOIN clienti cl ON cl.id = c.client_id
       WHERE c.numar LIKE ? ESCAPE '\\' OR cl.nume LIKE ? ESCAPE '\\'
       ORDER BY c.creat_la DESC LIMIT 6`
    )
    .all(like, like) as { id: number; numar: string | null; client_nume: string | null }[]) {
    out.push({
      tip: 'comanda',
      id: o.id,
      titlu: o.numar ?? `#${o.id}`,
      subtitlu: o.client_nume ?? 'Comandă',
      link: `/comenzi/${o.id}`
    })
  }

  return out
}
