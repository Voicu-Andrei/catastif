import { getDb } from '../connection'
import type { Furnizor, FurnizorInput } from '@shared/types'

export function listFurnizori(): Furnizor[] {
  return getDb()
    .prepare('SELECT * FROM furnizori ORDER BY nume COLLATE NOCASE')
    .all() as Furnizor[]
}

export function getFurnizor(id: number): Furnizor | undefined {
  return getDb().prepare('SELECT * FROM furnizori WHERE id = ?').get(id) as Furnizor | undefined
}

function bind(input: FurnizorInput): Record<string, unknown> {
  return {
    nume: input.nume,
    cui: input.cui ?? null,
    nr_reg_com: input.nr_reg_com ?? null,
    adresa: input.adresa ?? null,
    telefon: input.telefon ?? null,
    email: input.email ?? null,
    note: input.note ?? null
  }
}

export function createFurnizor(input: FurnizorInput): Furnizor {
  const info = getDb()
    .prepare(
      `INSERT INTO furnizori (nume, cui, nr_reg_com, adresa, telefon, email, note)
       VALUES (@nume, @cui, @nr_reg_com, @adresa, @telefon, @email, @note)`
    )
    .run(bind(input))
  return getFurnizor(Number(info.lastInsertRowid))!
}

export function updateFurnizor(id: number, input: FurnizorInput): Furnizor {
  getDb()
    .prepare(
      `UPDATE furnizori SET nume=@nume, cui=@cui, nr_reg_com=@nr_reg_com, adresa=@adresa,
        telefon=@telefon, email=@email, note=@note, actualizat_la=datetime('now')
       WHERE id=@id`
    )
    .run({ ...bind(input), id })
  return getFurnizor(id)!
}

export function deleteFurnizor(id: number): void {
  getDb().prepare('DELETE FROM furnizori WHERE id = ?').run(id)
}
