import { app } from 'electron'
import { join } from 'path'
import { existsSync, readdirSync, rmSync } from 'fs'
import { getDb } from './connection'
import { attachmentsDir } from '../backup'
import { rotesteFolder, snapshotDb, timestamp } from '../backup-core'
import { saveSetari } from './repos/setari'

// Ordinea contează: întâi „copiii", apoi „părinții", ca să nu cadă pe cheile
// străine (facturi → comenzi → clienți etc.). Tabela `setari` NU se atinge.
const TABELE_DATE = [
  'plati',
  'linii_comanda',
  'linii_achizitie',
  'fisiere',
  'facturi',
  'comenzi',
  'achizitii',
  'produse',
  'clienti',
  'furnizori'
] as const

export function folderPreStergere(): string {
  return join(app.getPath('userData'), 'pre-stergere')
}

// Golește complet registrele (produse, clienți, furnizori, comenzi, achiziții,
// plăți, atașamente), PĂSTRÂND datele firmei din Setări: nume, CUI, adresă,
// logo, folder de backup, cotă TVA implicită.
//
// Înainte de orice ștergere se face o copie completă a bazei în
// userData/pre-stergere/ — dacă butonul e apăsat din greșeală, datele se pot
// recupera din acel fișier. Întoarce calea copiei de siguranță.
export function resetBaza(): string {
  const db = getDb()

  // 1. Plasa de siguranță, înaintea oricărei modificări.
  const copie = join(folderPreStergere(), `inainte-de-stergere-${timestamp()}.db`)
  snapshotDb(db, copie)
  rotesteFolder(folderPreStergere(), 'inainte-de-stergere-', 5)

  // 2. Golirea propriu-zisă, totul sau nimic.
  const tx = db.transaction(() => {
    for (const tabel of TABELE_DATE) db.prepare(`DELETE FROM ${tabel}`).run()
    // Numerotarea reîncepe de la 1 (prima comandă redevine C0001).
    const areSecvente = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'")
      .get()
    if (areSecvente) db.prepare('DELETE FROM sqlite_sequence').run()
  })
  tx()

  // 3. Și numerotarea facturilor o ia de la capăt.
  saveSetari({ numar_factura_curent: 1 })

  // 4. Fișierele atașate de pe disc — mai puțin logo-ul, care ține de setări.
  const dir = attachmentsDir()
  if (existsSync(dir)) {
    for (const nume of readdirSync(dir)) {
      if (nume === '_firma') continue
      rmSync(join(dir, nume), { recursive: true, force: true })
    }
  }

  // 5. Spațiul eliberat se returnează sistemului de operare.
  db.exec('VACUUM')

  return copie
}
