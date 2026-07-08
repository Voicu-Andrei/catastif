import { afterEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../src/main/db/migrate'
import { MIGRATIONS } from '../src/main/db/migrations'

let db: Database.Database

afterEach(() => db?.close())

describe('migrații', () => {
  it('versiunile sunt unice și strict crescătoare', () => {
    const versiuni = MIGRATIONS.map((m) => m.version)
    expect(new Set(versiuni).size).toBe(versiuni.length)
    expect([...versiuni].sort((a, b) => a - b)).toEqual(versiuni)
  })

  it('o bază nouă ajunge la ultima versiune, cu tabelele de bază prezente', () => {
    db = new Database(':memory:')
    runMigrations(db)
    const v = db.pragma('user_version', { simple: true })
    expect(v).toBe(MIGRATIONS[MIGRATIONS.length - 1].version)
    const tabele = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name)
    for (const t of [
      'setari',
      'clienti',
      'produse',
      'furnizori',
      'comenzi',
      'linii_comanda',
      'achizitii',
      'linii_achizitie',
      'facturi',
      'fisiere'
    ]) {
      expect(tabele).toContain(t)
    }
  })

  it('re-rularea migrațiilor este idempotentă (nu se aplică nimic a doua oară)', () => {
    db = new Database(':memory:')
    runMigrations(db)
    expect(() => runMigrations(db)).not.toThrow()
    expect(db.pragma('user_version', { simple: true })).toBe(
      MIGRATIONS[MIGRATIONS.length - 1].version
    )
  })

  it('v2 transformă achitatul existent într-o plată inițială', () => {
    db = new Database(':memory:')
    // Aplică doar v1, inserează o comandă parțial plătită, apoi migrează la zi.
    const v1 = MIGRATIONS.find((m) => m.version === 1)!
    db.exec(v1.sql)
    db.pragma('user_version = 1')
    db.prepare(
      "INSERT INTO comenzi (numar, stare, total, achitat) VALUES ('C0001', 'comanda', 10000, 4000)"
    ).run()
    runMigrations(db)
    const plati = db.prepare('SELECT * FROM plati').all() as { comanda_id: number; suma: number }[]
    expect(plati.length).toBe(1)
    expect(plati[0].suma).toBe(4000)
  })

  it('migrațiile pornesc de la versiunea curentă, nu de la zero (datele existente rămân)', () => {
    db = new Database(':memory:')
    runMigrations(db)
    db.prepare('INSERT INTO clienti (tip, nume) VALUES (?, ?)').run('persoana', 'Ion')
    runMigrations(db)
    expect(db.prepare('SELECT COUNT(*) c FROM clienti').get()).toEqual({ c: 1 })
  })
})
