import { describe, it, expect, afterEach } from 'vitest'
import { normalizeazaUm, etichetaUm, UM_SELECT_DATA } from '../shared/um'
import { createProdus } from '../src/main/db/repos/produse'
import { createComanda } from '../src/main/db/repos/comenzi'
import { createAchizitie } from '../src/main/db/repos/achizitii'
import { runMigrations } from '../src/main/db/migrate'
import { MIGRATIONS } from '../src/main/db/migrations'
import { closeDb } from '../src/main/db/connection'
import { freshDb } from './helpers'
import Database from 'better-sqlite3'

afterEach(() => closeDb())

describe('unități de măsură', () => {
  it('lista oferită interfeței conține exact Buc, Mp și Ml', () => {
    expect(UM_SELECT_DATA).toEqual([
      { value: 'buc', label: 'Buc' },
      { value: 'mp', label: 'Mp' },
      { value: 'ml', label: 'Ml' }
    ])
  })

  it('normalizează textul liber scris de mână la valorile cunoscute', () => {
    expect(normalizeazaUm('mp')).toBe('mp')
    expect(normalizeazaUm('MP')).toBe('mp')
    expect(normalizeazaUm('m2')).toBe('mp')
    expect(normalizeazaUm('metru patrat')).toBe('mp')
    expect(normalizeazaUm('ml')).toBe('ml')
    expect(normalizeazaUm('m.l.')).toBe('ml')
    expect(normalizeazaUm('metru liniar')).toBe('ml')
  })

  it('orice altceva — inclusiv gol sau necunoscut — devine „buc”', () => {
    expect(normalizeazaUm('bucata')).toBe('buc')
    expect(normalizeazaUm('')).toBe('buc')
    expect(normalizeazaUm(null)).toBe('buc')
    expect(normalizeazaUm(undefined)).toBe('buc')
    expect(normalizeazaUm('kg')).toBe('buc')
  })

  it('eticheta afișată este cea din listă, nu valoarea stocată', () => {
    expect(etichetaUm('mp')).toBe('Mp')
    expect(etichetaUm('m2')).toBe('Mp')
    expect(etichetaUm('orice')).toBe('Buc')
  })

  it('unitatea se normalizează la scriere, pe produse, comenzi și achiziții', () => {
    freshDb()
    const p = createProdus({
      nume: 'Geam',
      descriere: null,
      unitate_masura: 'M2',
      cost_referinta: null,
      pret_referinta: null,
      cota_tva: 21,
      track_stock: false,
      stoc_curent: 0,
      prag_stoc: null,
      furnizor_id: null
    })
    expect(p.unitate_masura).toBe('mp')

    const c = createComanda({
      numar: null,
      client_id: null,
      observatii: null,
      linii: [
        {
          produs_id: p.id,
          descriere: 'Geam',
          cantitate: 2,
          unitate_masura: 'm.l.',
          cost_unitar: 1000,
          pret_unitar: 2000,
          cota_tva: 21,
          pozitie: 0
        }
      ]
    })
    expect(c.linii[0].unitate_masura).toBe('ml')

    const a = createAchizitie({
      furnizor_id: null,
      data: '2026-01-15',
      numar_document: null,
      observatii: null,
      linii: [
        {
          produs_id: p.id,
          descriere: 'Geam',
          cantitate: 3,
          unitate_masura: 'necunoscut',
          cost_unitar: 900,
          data: '2026-01-15'
        }
      ]
    })
    expect(a.linii[0].unitate_masura).toBe('buc')
  })
})

describe('migrația v3', () => {
  it('adaugă costul produsului și normalizează unitățile existente', () => {
    // Pornim de la schema v1/v2 cu date „murdare”, exact ca într-o instalare veche.
    const db = new Database(':memory:')
    for (const m of MIGRATIONS.filter((x) => x.version <= 2)) db.exec(m.sql)
    db.pragma('user_version = 2')
    db.prepare(
      `INSERT INTO produse (nume, unitate_masura, pret_referinta, cota_tva) VALUES (?, ?, ?, ?)`
    ).run('Fereastră', 'M2', 50000, 21)
    db.prepare(
      `INSERT INTO produse (nume, unitate_masura, pret_referinta, cota_tva) VALUES (?, ?, ?, ?)`
    ).run('Glaf', 'm.l.', 3000, 21)
    db.prepare(`INSERT INTO comenzi (stare) VALUES ('oferta')`).run()
    db.prepare(
      `INSERT INTO linii_comanda (comanda_id, descriere, unitate_masura) VALUES (1, 'x', 'bucata')`
    ).run()

    runMigrations(db)

    const produse = db
      .prepare(
        'SELECT nume, unitate_masura, cost_referinta, pret_referinta FROM produse ORDER BY id'
      )
      .all() as {
      nume: string
      unitate_masura: string
      cost_referinta: number | null
      pret_referinta: number
    }[]

    // Ne uităm doar la produsele existente înainte de migrații — v4 mai semănă
    // unul, „Montaj”, verificat separat în tests/montaj.test.ts.
    const vechi = produse.filter((p) => p.nume !== 'Montaj')
    // Unitățile ajung pe lista fixă...
    expect(vechi.map((p) => p.unitate_masura)).toEqual(['mp', 'ml'])
    // ...prețul de vânzare rămâne neatins (nu îl mutăm în cost)...
    expect(vechi.map((p) => p.pret_referinta)).toEqual([50000, 3000])
    // ...iar costul pornește gol, de completat de utilizator.
    expect(vechi.map((p) => p.cost_referinta)).toEqual([null, null])

    const linie = db.prepare('SELECT unitate_masura FROM linii_comanda').get() as {
      unitate_masura: string
    }
    expect(linie.unitate_masura).toBe('buc')
    db.close()
  })
})
