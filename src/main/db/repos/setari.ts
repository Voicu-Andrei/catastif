import { getDb } from '../connection'
import type { Setari } from '@shared/types'

export const DEFAULT_SETARI: Setari = {
  nume_firma: '',
  cui: '',
  nr_reg_com: '',
  adresa: '',
  judet: '',
  oras: '',
  cod_postal: '',
  iban: '',
  telefon: '',
  email: '',
  logo_path: null,
  cota_tva_implicita: 21,
  serie_factura: 'CTF',
  numar_factura_curent: 1,
  backup_folder: null,
  auto_backup: false,
  prag_stoc_implicit: 5,
  versiune_ignorata: null
}

interface RandSetare {
  cheie: string
  valoare: string
}

// Citește toate setările și le suprapune peste valorile implicite.
export function getSetari(): Setari {
  const db = getDb()
  const rows = db.prepare('SELECT cheie, valoare FROM setari').all() as RandSetare[]
  const out: Record<string, unknown> = { ...DEFAULT_SETARI }
  for (const r of rows) {
    if (r.cheie in DEFAULT_SETARI) {
      try {
        out[r.cheie] = JSON.parse(r.valoare)
      } catch {
        // ignorăm valori corupte; rămâne implicitul
      }
    }
  }
  return out as unknown as Setari
}

// Salvează doar cheile transmise (upsert), apoi întoarce setările complete.
export function saveSetari(patch: Partial<Setari>): Setari {
  const db = getDb()
  const stmt = db.prepare(
    `INSERT INTO setari (cheie, valoare) VALUES (?, ?)
     ON CONFLICT(cheie) DO UPDATE SET valoare = excluded.valoare`
  )
  const tx = db.transaction((entries: [string, unknown][]) => {
    for (const [k, v] of entries) stmt.run(k, JSON.stringify(v))
  })
  tx(Object.entries(patch))
  return getSetari()
}
