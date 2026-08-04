import { describe, it, expect, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { MIGRATIONS } from '../src/main/db/migrations'
import { runMigrations } from '../src/main/db/migrate'
import { closeDb } from '../src/main/db/connection'
import {
  createComanda,
  updateComanda,
  acceptaComanda,
  anuleazaComanda,
  marcheazaMontat,
  listComenzi,
  getComanda
} from '../src/main/db/repos/comenzi'
import { createProdus, getProdus } from '../src/main/db/repos/produse'
import { getDashboard } from '../src/main/db/repos/dashboard'
import { freshDb } from './helpers'

afterEach(() => closeDb())

const zi = (offset: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

const produsSimplu = (
  nume: string,
  over: Record<string, unknown> = {}
): ReturnType<typeof createProdus> =>
  createProdus({
    nume,
    descriere: null,
    unitate_masura: 'buc',
    cost_referinta: null,
    pret_referinta: null,
    cota_tva: 21,
    track_stock: false,
    stoc_curent: 0,
    prag_stoc: null,
    furnizor_id: null,
    ...over
  } as Parameters<typeof createProdus>[0])

const linie = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  produs_id: null,
  descriere: 'Rulou',
  cantitate: 1,
  unitate_masura: 'buc',
  cost_unitar: 10000,
  pret_unitar: 20000,
  cota_tva: 21,
  pozitie: 0,
  ...over
})

describe('montaj — semănarea produsului (migrația v4)', () => {
  it('creează exact un produs „Montaj”, neutru față de stoc', () => {
    freshDb()
    const montaj = getProdus(1)
    // Este primul rând inserat de migrație pe o bază nouă.
    expect(montaj?.nume).toBe('Montaj')
    expect(montaj?.track_stock).toBe(false)
    expect(montaj?.unitate_masura).toBe('buc')
    // Costul și prețul rămân goale: le completează patronul.
    expect(montaj?.cost_referinta).toBeNull()
    expect(montaj?.pret_referinta).toBeNull()
  })

  it('nu îl semănă a doua oară dacă există deja unul, indiferent de litere', () => {
    const db = new Database(':memory:')
    for (const m of MIGRATIONS.filter((x) => x.version <= 3)) db.exec(m.sql)
    db.pragma('user_version = 3')
    db.prepare(
      `INSERT INTO produse (nume, unitate_masura, cota_tva) VALUES ('montaj', 'buc', 21)`
    ).run()

    runMigrations(db)

    const n = db
      .prepare(`SELECT COUNT(*) c FROM produse WHERE nume = 'Montaj' COLLATE NOCASE`)
      .get() as { c: number }
    expect(n.c).toBe(1)
    db.close()
  })

  it('păstrează datele existente și adaugă cele patru coloane', () => {
    const db = new Database(':memory:')
    for (const m of MIGRATIONS.filter((x) => x.version <= 3)) db.exec(m.sql)
    db.pragma('user_version = 3')
    db.prepare(
      `INSERT INTO comenzi (numar, stare, total_fara_tva, total_tva, total)
       VALUES ('C0001', 'comanda', 10000, 2100, 12100)`
    ).run()

    runMigrations(db)

    const c = db.prepare('SELECT * FROM comenzi WHERE numar = ?').get('C0001') as Record<
      string,
      unknown
    >
    expect(c.total).toBe(12100)
    expect(c.stare).toBe('comanda')
    // Coloanele noi există și pornesc goale.
    expect(c.data_montaj).toBeNull()
    expect(c.adresa_montaj).toBeNull()
    expect(c.detalii_montaj).toBeNull()
    expect(c.montaj_finalizat_la).toBeNull()
    db.close()
  })
})

describe('montaj ca linie de comandă', () => {
  it('intră în totaluri și în profit ca orice altă linie', () => {
    freshDb()
    const c = createComanda({
      numar: null,
      client_id: null,
      observatii: null,
      linii: [
        linie({ cantitate: 2, cost_unitar: 30000, pret_unitar: 50000, pozitie: 0 }),
        linie({ descriere: 'Montaj', cost_unitar: 15000, pret_unitar: 35000, pozitie: 1 })
      ] as never
    })
    // 2×500 + 1×350 = 1350 lei fără TVA
    expect(c.total_fara_tva).toBe(135000)
    expect(c.total_tva).toBe(28350)
    expect(c.total).toBe(163350)
    // profit = (100000−60000) + (35000−15000) = 60000 bani
    expect(c.profit).toBe(60000)
  })

  it('un produs „Montaj” cu track_stock=0 nu atinge stocul la acceptare', () => {
    freshDb()
    const montaj = produsSimplu('Montaj manoperă')
    const marfa = produsSimplu('Rulou', { track_stock: true, stoc_curent: 10 })

    const c = createComanda({
      numar: null,
      client_id: null,
      observatii: null,
      linii: [
        linie({ produs_id: marfa.id, cantitate: 3, pozitie: 0 }),
        linie({ produs_id: montaj.id, descriere: 'Montaj', cantitate: 1, pozitie: 1 })
      ] as never
    })
    acceptaComanda(c.id)

    expect(getProdus(marfa.id)?.stoc_curent).toBe(7)
    expect(getProdus(montaj.id)?.stoc_curent).toBe(0)
  })
})

describe('montaj — câmpurile de programare', () => {
  it('fac dus-întors prin create și get', () => {
    freshDb()
    const c = createComanda({
      numar: null,
      client_id: null,
      observatii: null,
      data_montaj: '2026-04-14',
      adresa_montaj: 'Str. Lalelelor 3, ap. 12',
      detalii_montaj: 'Etaj 4, fără lift',
      linii: [linie()] as never
    })
    expect(c.data_montaj).toBe('2026-04-14')
    expect(c.adresa_montaj).toBe('Str. Lalelelor 3, ap. 12')
    expect(c.detalii_montaj).toBe('Etaj 4, fără lift')
  })

  it('șirul gol devine NULL, nu text gol', () => {
    freshDb()
    const c = createComanda({
      numar: null,
      client_id: null,
      observatii: null,
      data_montaj: '',
      adresa_montaj: '   ',
      linii: [linie()] as never
    })
    expect(c.data_montaj).toBeNull()
    expect(c.adresa_montaj).toBeNull()
  })

  it('o comandă fără montaj este perfect validă', () => {
    freshDb()
    const c = createComanda({
      numar: null,
      client_id: null,
      observatii: null,
      linii: [linie()] as never
    })
    expect(c.data_montaj).toBeNull()
    expect(c.stare_montaj).toBe('nespecificat') // e ofertă
  })

  it('respinge o dată în alt format', () => {
    freshDb()
    const baza = { numar: null, client_id: null, observatii: null, linii: [linie()] as never }
    expect(() => createComanda({ ...baza, data_montaj: '14.04.2026' })).toThrow(
      /Data montajului nu este validă/
    )
    expect(() => createComanda({ ...baza, data_montaj: '2026-4-1' })).toThrow(
      /Data montajului nu este validă/
    )
  })

  it('salvarea comenzii NU șterge faptul că montajul s-a efectuat', () => {
    freshDb()
    const c = createComanda({
      numar: null,
      client_id: null,
      observatii: null,
      data_montaj: zi(-1),
      linii: [linie()] as never
    })
    acceptaComanda(c.id)
    marcheazaMontat(c.id, true)
    const inainte = getComanda(c.id)!.montaj_finalizat_la
    expect(inainte).not.toBeNull()

    updateComanda(c.id, {
      numar: null,
      client_id: null,
      observatii: 'schimbat',
      data_montaj: zi(-1),
      linii: [linie({ pret_unitar: 99000 })] as never
    })

    expect(getComanda(c.id)!.montaj_finalizat_la).toBe(inainte)
  })
})

describe('montaj — marcarea ca efectuat', () => {
  it('merge doar pe o comandă confirmată', () => {
    freshDb()
    const oferta = createComanda({
      numar: null,
      client_id: null,
      observatii: null,
      linii: [linie()] as never
    })
    expect(() => marcheazaMontat(oferta.id, true)).toThrow(/doar pe o comandă confirmată/)
    expect(getComanda(oferta.id)!.montaj_finalizat_la).toBeNull()

    acceptaComanda(oferta.id)
    expect(marcheazaMontat(oferta.id, true).montaj_finalizat_la).not.toBeNull()

    anuleazaComanda(oferta.id)
    expect(() => marcheazaMontat(oferta.id, true)).toThrow(/doar pe o comandă confirmată/)
  })

  it('se poate anula marcajul, dacă s-a apăsat din greșeală', () => {
    freshDb()
    const c = createComanda({
      numar: null,
      client_id: null,
      observatii: null,
      linii: [linie()] as never
    })
    acceptaComanda(c.id)
    marcheazaMontat(c.id, true)
    expect(marcheazaMontat(c.id, false).montaj_finalizat_la).toBeNull()
  })
})

describe('montaj — starea derivată', () => {
  const comandaCu = (data: string | null): number => {
    const c = createComanda({
      numar: null,
      client_id: null,
      observatii: null,
      data_montaj: data,
      linii: [linie()] as never
    })
    acceptaComanda(c.id)
    return c.id
  }

  it('acoperă toate cele cinci valori', () => {
    freshDb()
    expect(getComanda(comandaCu(null))!.stare_montaj).toBe('neprogramat')
    expect(getComanda(comandaCu(zi(1)))!.stare_montaj).toBe('programat')
    // Chiar în ziua lucrării nu este încă întârziat.
    expect(getComanda(comandaCu(zi(0)))!.stare_montaj).toBe('programat')
    expect(getComanda(comandaCu(zi(-3)))!.stare_montaj).toBe('intarziat')

    const montat = comandaCu(zi(-3))
    marcheazaMontat(montat, true)
    expect(getComanda(montat)!.stare_montaj).toBe('montat')
  })

  it('ofertele și comenzile anulate sunt mereu „nespecificat”, chiar cu dată în trecut', () => {
    freshDb()
    // O ofertă cu dată pusă în creion nu trebuie să apară „Programat”.
    const oferta = createComanda({
      numar: null,
      client_id: null,
      observatii: null,
      data_montaj: zi(-5),
      linii: [linie()] as never
    })
    expect(getComanda(oferta.id)!.stare_montaj).toBe('nespecificat')

    // Iar o comandă anulată nu trebuie să poarte la nesfârșit badge-ul roșu.
    const c = comandaCu(zi(-5))
    expect(getComanda(c)!.stare_montaj).toBe('intarziat')
    anuleazaComanda(c)
    expect(getComanda(c)!.stare_montaj).toBe('nespecificat')
  })

  it('lista întoarce aceeași stare ca detaliul', () => {
    freshDb()
    const id = comandaCu(zi(-2))
    const dinLista = listComenzi().find((x) => x.id === id)!
    expect(dinLista.stare_montaj).toBe('intarziat')
  })
})

describe('montaj — agregatele de pe tabloul de bord', () => {
  it('numără montajele de făcut și pe cele întârziate, doar pe comenzi confirmate', () => {
    freshDb()
    const confirmata = (data: string | null): number => {
      const c = createComanda({
        numar: null,
        client_id: null,
        observatii: null,
        data_montaj: data,
        linii: [linie()] as never
      })
      acceptaComanda(c.id)
      return c.id
    }

    confirmata(zi(3)) // în următoarele 7 zile
    confirmata(zi(-5)) // întârziat (intră și în „de făcut”)
    const gata = confirmata(zi(-1))
    marcheazaMontat(gata, true) // efectuat — nu se mai numără
    confirmata(zi(30)) // prea departe
    confirmata(null) // neprogramat
    // O ofertă cu dată în trecut nu trebuie să intre în nicio numărătoare.
    createComanda({
      numar: null,
      client_id: null,
      observatii: null,
      data_montaj: zi(-9),
      linii: [linie()] as never
    })

    const d = getDashboard()
    expect(d.montaje_saptamana).toBe(2) // cea de peste 3 zile + cea întârziată
    expect(d.montaje_intarziate).toBe(1)
  })

  it('montajul ca linie intră normal în încasări și profit', () => {
    freshDb()
    const c = createComanda({
      numar: null,
      client_id: null,
      observatii: null,
      linii: [linie({ descriere: 'Montaj', cost_unitar: 10000, pret_unitar: 30000 })] as never
    })
    acceptaComanda(c.id)
    const d = getDashboard()
    expect(d.de_incasat).toBe(36300) // 300 lei + 21% TVA
    expect(d.profit_luna).toBe(20000)
  })
})
