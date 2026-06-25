import { getDb } from '../connection'
import type { Produs, ProdusInput } from '@shared/types'

interface RandProdus extends Omit<Produs, 'track_stock'> {
  track_stock: number
}

function map(r: RandProdus | undefined): Produs | undefined {
  if (!r) return undefined
  return { ...r, track_stock: !!r.track_stock }
}

const SELECT = `
  SELECT p.*, (
    SELECT la.cost_unitar FROM linii_achizitie la
    WHERE la.produs_id = p.id ORDER BY la.data DESC, la.id DESC LIMIT 1
  ) AS ultim_cost
  FROM produse p`

export function listProduse(): Produs[] {
  const rows = getDb()
    .prepare(`${SELECT} ORDER BY p.nume COLLATE NOCASE`)
    .all() as RandProdus[]
  return rows.map((r) => map(r)!)
}

export function getProdus(id: number): Produs | undefined {
  return map(getDb().prepare(`${SELECT} WHERE p.id = ?`).get(id) as RandProdus | undefined)
}

function bind(input: ProdusInput): Record<string, unknown> {
  return {
    nume: input.nume,
    descriere: input.descriere ?? null,
    unitate_masura: input.unitate_masura || 'buc',
    pret_referinta: input.pret_referinta ?? null,
    cota_tva: input.cota_tva,
    track_stock: input.track_stock ? 1 : 0,
    stoc_curent: input.stoc_curent ?? 0,
    prag_stoc: input.prag_stoc ?? null,
    furnizor_id: input.furnizor_id ?? null
  }
}

export function createProdus(input: ProdusInput): Produs {
  const info = getDb()
    .prepare(
      `INSERT INTO produse (nume, descriere, unitate_masura, pret_referinta, cota_tva,
        track_stock, stoc_curent, prag_stoc, furnizor_id)
       VALUES (@nume, @descriere, @unitate_masura, @pret_referinta, @cota_tva,
        @track_stock, @stoc_curent, @prag_stoc, @furnizor_id)`
    )
    .run(bind(input))
  return getProdus(Number(info.lastInsertRowid))!
}

export function updateProdus(id: number, input: ProdusInput): Produs {
  getDb()
    .prepare(
      `UPDATE produse SET nume=@nume, descriere=@descriere, unitate_masura=@unitate_masura,
        pret_referinta=@pret_referinta, cota_tva=@cota_tva, track_stock=@track_stock,
        stoc_curent=@stoc_curent, prag_stoc=@prag_stoc, furnizor_id=@furnizor_id,
        actualizat_la=datetime('now')
       WHERE id=@id`
    )
    .run({ ...bind(input), id })
  return getProdus(id)!
}

export function deleteProdus(id: number): void {
  getDb().prepare('DELETE FROM produse WHERE id = ?').run(id)
}
