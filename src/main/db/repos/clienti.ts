import { getDb } from '../connection'
import type { Client, ClientInput } from '@shared/types'

export function listClienti(): Client[] {
  return getDb().prepare('SELECT * FROM clienti ORDER BY nume COLLATE NOCASE').all() as Client[]
}

export function getClient(id: number): Client | undefined {
  return getDb().prepare('SELECT * FROM clienti WHERE id = ?').get(id) as Client | undefined
}

function bind(input: ClientInput): Record<string, unknown> {
  return {
    tip: input.tip,
    nume: input.nume,
    cui: input.cui ?? null,
    nr_reg_com: input.nr_reg_com ?? null,
    cnp: input.cnp ?? null,
    adresa: input.adresa ?? null,
    judet: input.judet ?? null,
    oras: input.oras ?? null,
    cod_postal: input.cod_postal ?? null,
    telefon: input.telefon ?? null,
    email: input.email ?? null,
    note: input.note ?? null
  }
}

export function createClient(input: ClientInput): Client {
  const info = getDb()
    .prepare(
      `INSERT INTO clienti (tip, nume, cui, nr_reg_com, cnp, adresa, judet, oras, cod_postal, telefon, email, note)
       VALUES (@tip, @nume, @cui, @nr_reg_com, @cnp, @adresa, @judet, @oras, @cod_postal, @telefon, @email, @note)`
    )
    .run(bind(input))
  return getClient(Number(info.lastInsertRowid))!
}

export function updateClient(id: number, input: ClientInput): Client {
  getDb()
    .prepare(
      `UPDATE clienti SET tip=@tip, nume=@nume, cui=@cui, nr_reg_com=@nr_reg_com, cnp=@cnp,
        adresa=@adresa, judet=@judet, oras=@oras, cod_postal=@cod_postal, telefon=@telefon,
        email=@email, note=@note, actualizat_la=datetime('now')
       WHERE id=@id`
    )
    .run({ ...bind(input), id })
  return getClient(id)!
}

export function deleteClient(id: number): void {
  getDb().prepare('DELETE FROM clienti WHERE id = ?').run(id)
}
