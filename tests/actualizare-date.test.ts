import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, existsSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { getDb, closeDb, getDbPath, preActualizareDir } from '../src/main/db/connection'
import { versiuneSchemaAplicatie, versiuneSchemaFisier } from '../src/main/db/migrate'
import { MIGRATIONS } from '../src/main/db/migrations'

// Ce se întâmplă cu datele existente atunci când utilizatorul instalează o
// versiune nouă. Aici stă promisiunea centrală a aplicației: actualizarea
// schimbă programul, niciodată evidența firmei.

function folderNou(): string {
  closeDb()
  const dir = mkdtempSync(join(tmpdir(), 'catastif-upd-'))
  process.env.CATASTIF_TEST_USERDATA = dir
  return dir
}

// Construiește pe disc o bază așa cum ar fi lăsat-o o versiune mai veche.
function bazaLaVersiunea(dir: string, versiune: number, dupa?: (db: Database.Database) => void) {
  const db = new Database(join(dir, 'catastif.db'))
  db.pragma('journal_mode = WAL')
  for (const m of MIGRATIONS.filter((m) => m.version <= versiune)) {
    db.exec(m.sql)
    db.pragma(`user_version = ${m.version}`)
  }
  dupa?.(db)
  db.close()
}

afterEach(() => closeDb())

describe('datele supraviețuiesc actualizării aplicației', () => {
  it('păstrează înregistrările existente când schema urcă la o versiune nouă', () => {
    const dir = folderNou()
    bazaLaVersiunea(dir, 1, (db) => {
      db.prepare('INSERT INTO clienti (tip, nume) VALUES (?, ?)').run('persoana', 'Ana Pop')
      db.prepare('INSERT INTO produse (nume, unitate_masura, cota_tva) VALUES (?, ?, ?)').run(
        'Fereastră PVC',
        'buc',
        21
      )
    })

    const db = getDb()

    expect(versiuneSchemaFisier(db)).toBe(versiuneSchemaAplicatie())
    expect(db.prepare('SELECT nume FROM clienti').pluck().all()).toEqual(['Ana Pop'])
    expect(db.prepare('SELECT nume FROM produse').pluck().all()).toEqual(['Fereastră PVC'])
  })

  it('lasă o copie de siguranță înainte de a atinge schema', () => {
    const dir = folderNou()
    bazaLaVersiunea(dir, 1, (db) => {
      db.prepare('INSERT INTO clienti (tip, nume) VALUES (?, ?)').run('firma', 'SC Exemplu SRL')
    })

    getDb()

    const copii = readdirSync(preActualizareDir())
    expect(copii.filter((n) => n.startsWith('catastif-schema1-'))).toHaveLength(1)

    // Copia nu e doar un fișier gol: chiar conține datele de dinaintea migrației.
    const copie = new Database(join(preActualizareDir(), copii[0]), { readonly: true })
    expect(copie.prepare('SELECT nume FROM clienti').pluck().all()).toEqual(['SC Exemplu SRL'])
    expect(copie.pragma('user_version', { simple: true })).toBe(1)
    copie.close()
  })

  it('nu face copie la prima pornire, când nu există încă date', () => {
    folderNou()
    getDb()
    expect(existsSync(preActualizareDir())).toBe(false)
  })

  it('nu face copie când schema este deja la zi (pornire obișnuită)', () => {
    const dir = folderNou()
    bazaLaVersiunea(dir, versiuneSchemaAplicatie())

    getDb()

    expect(existsSync(preActualizareDir())).toBe(false)
  })

  it('refuză o bază scrisă de o versiune mai nouă, în loc să scrie peste ea', () => {
    // Se întâmplă la revenirea pe o versiune veche sau la restaurarea unui
    // backup făcut de o versiune mai nouă. Codul vechi nu cunoaște coloanele
    // noi: dacă ar continua, ar salva date incomplete peste cele bune.
    const dir = folderNou()
    bazaLaVersiunea(dir, versiuneSchemaAplicatie(), (db) => {
      db.prepare('INSERT INTO clienti (tip, nume) VALUES (?, ?)').run('persoana', 'Ion Ionescu')
      db.pragma('user_version = 999')
    })

    expect(() => getDb()).toThrow(/versiune mai nouă/i)

    // Iar datele rămân exact cum erau — nimic nu a fost migrat sau șters.
    const dupa = new Database(getDbPath(), { readonly: true })
    expect(dupa.prepare('SELECT nume FROM clienti').pluck().all()).toEqual(['Ion Ionescu'])
    expect(dupa.pragma('user_version', { simple: true })).toBe(999)
    dupa.close()
  })

  it('nu lasă conexiunea deschisă când deschiderea eșuează', () => {
    const dir = folderNou()
    bazaLaVersiunea(dir, versiuneSchemaAplicatie(), (db) => db.pragma('user_version = 999'))

    expect(() => getDb()).toThrow()
    // O a doua încercare trebuie să dea aceeași eroare, nu să întoarcă o
    // conexiune pe jumătate inițializată rămasă din prima.
    expect(() => getDb()).toThrow(/versiune mai nouă/i)
  })
})
