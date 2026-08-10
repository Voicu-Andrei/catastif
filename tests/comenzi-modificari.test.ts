import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { freshDb } from './helpers'
import { closeDb, getDb } from '../src/main/db/connection'
import {
  createComanda,
  updateComanda,
  acceptaComanda,
  anuleazaComanda,
  inregistreazaPlata,
  deleteComanda,
  getComanda
} from '../src/main/db/repos/comenzi'
import { getDashboard } from '../src/main/db/repos/dashboard'
import { getRapoarte } from '../src/main/db/repos/rapoarte'
import { createClient } from '../src/main/db/repos/clienti'
import type { ComandaInput, LinieComandaInput } from '../shared/types'

const linie = (extra?: Partial<LinieComandaInput>): LinieComandaInput => ({
  produs_id: null,
  descriere: 'Fereastră PVC',
  cantitate: 1,
  unitate_masura: 'buc',
  cost_unitar: 30000,
  pret_unitar: 50000,
  cota_tva: 21,
  pozitie: 0,
  ...extra
})

const comanda = (extra?: Partial<ComandaInput>): ComandaInput => ({
  numar: null,
  client_id: null,
  observatii: null,
  linii: [linie()],
  ...extra
})

const anCurent = new Date().getFullYear()

beforeEach(() => freshDb())
afterEach(() => closeDb())

describe('ștergerea definitivă a unei comenzi anulate', () => {
  it('o comandă anulată poate fi ștearsă complet', () => {
    const c = createComanda(comanda())
    acceptaComanda(c.id)
    anuleazaComanda(c.id)

    expect(() => deleteComanda(c.id)).not.toThrow()
    expect(getComanda(c.id)).toBeUndefined()
  })

  it('ștergerea duce cu ea liniile și plățile (fără rânduri orfane)', () => {
    const c = createComanda(comanda())
    inregistreazaPlata(c.id, 20000)
    anuleazaComanda(c.id)
    deleteComanda(c.id)

    const db = getDb()
    expect((db.prepare('SELECT COUNT(*) v FROM linii_comanda').get() as { v: number }).v).toBe(0)
    expect((db.prepare('SELECT COUNT(*) v FROM plati').get() as { v: number }).v).toBe(0)
  })

  it('o comandă ACTIVĂ tot nu poate fi ștearsă — trebuie anulată întâi', () => {
    const c = createComanda(comanda())
    acceptaComanda(c.id)
    expect(() => deleteComanda(c.id)).toThrow(/Anuleaz/)
    expect(getComanda(c.id)).toBeDefined()
  })

  it('ofertele rămân ștergibile ca înainte', () => {
    const c = createComanda(comanda())
    expect(() => deleteComanda(c.id)).not.toThrow()
    expect(getComanda(c.id)).toBeUndefined()
  })
})

describe('data comenzii', () => {
  it('se folosește data aleasă, nu ziua curentă', () => {
    const c = createComanda(comanda({ data: '2026-03-14' }))
    expect(c.data_creare.slice(0, 10)).toBe('2026-03-14')
  })

  it('fără dată aleasă rămâne ziua curentă', () => {
    const c = createComanda(comanda())
    const azi = new Date().toISOString().slice(0, 10)
    expect(c.data_creare.slice(0, 10)).toBe(azi)
  })

  it('data poate fi corectată ulterior', () => {
    const c = createComanda(comanda({ data: '2026-03-14' }))
    const dupa = updateComanda(c.id, comanda({ numar: c.numar, data: '2026-05-02' }))
    expect(dupa.data_creare.slice(0, 10)).toBe('2026-05-02')
  })

  it('o salvare care nu schimbă ziua păstrează ora originală', () => {
    const c = createComanda(comanda({ data: '2026-03-14' }))
    const inainte = c.data_creare
    const dupa = updateComanda(c.id, comanda({ numar: c.numar, data: '2026-03-14' }))
    expect(dupa.data_creare).toBe(inainte)
  })

  it('o dată invalidă este respinsă', () => {
    expect(() => createComanda(comanda({ data: '14-03-2026' }))).toThrow(/Data comenzii/)
    expect(() => createComanda(comanda({ data: 'maine' }))).toThrow(/Data comenzii/)
  })
})

describe('statisticile ignoră comenzile anulate', () => {
  // O comandă confirmată și una anulată, identice ca valoare: tot ce apare în
  // statistici trebuie să reflecte doar prima.
  function douaComenzi(): void {
    const cl = createClient({
      tip: 'firma',
      nume: 'SC Geam SRL',
      cui: null,
      nr_reg_com: null,
      cnp: null,
      adresa: null,
      judet: null,
      oras: null,
      cod_postal: null,
      telefon: null,
      email: null,
      note: null
    })
    const buna = createComanda(comanda({ client_id: cl.id }))
    acceptaComanda(buna.id)
    inregistreazaPlata(buna.id, 10000)

    const rea = createComanda(comanda({ client_id: cl.id }))
    acceptaComanda(rea.id)
    inregistreazaPlata(rea.id, 10000)
    anuleazaComanda(rea.id)
  }

  it('tabloul de bord numără și însumează doar comanda validă', () => {
    douaComenzi()
    const d = getDashboard()
    expect(d.comenzi_active).toBe(1)
    expect(d.oferte_in_asteptare).toBe(0)
    // 60.500 total − 10.000 achitat = 50.500, o singură dată
    expect(d.de_incasat).toBe(60500 - 10000)
    expect(d.profit_luna).toBe(20000)
  })

  it('rapoartele anuale exclud comanda anulată', () => {
    douaComenzi()
    const r = getRapoarte(anCurent)

    const vanzari = r.vanzari_lunare.reduce((s, m) => s + m.total_fara_tva, 0)
    const profit = r.vanzari_lunare.reduce((s, m) => s + m.profit, 0)
    expect(vanzari).toBe(50000)
    expect(profit).toBe(20000)

    expect(r.profit_pe_client.length).toBe(1)
    expect(r.profit_pe_client[0].total).toBe(50000)

    // „De încasat” listează o singură comandă, nu două
    expect(r.de_incasat.length).toBe(1)
  })

  it('anularea unei comenzi o scoate imediat din statistici', () => {
    const c = createComanda(comanda())
    acceptaComanda(c.id)
    expect(getDashboard().comenzi_active).toBe(1)

    anuleazaComanda(c.id)
    const d = getDashboard()
    expect(d.comenzi_active).toBe(0)
    expect(d.de_incasat).toBe(0)
    expect(d.profit_luna).toBe(0)
    expect(getRapoarte(anCurent).de_incasat.length).toBe(0)
  })

  it('o ofertă neacceptată nu intră în vânzări sau profit', () => {
    createComanda(comanda())
    const d = getDashboard()
    expect(d.oferte_in_asteptare).toBe(1)
    expect(d.comenzi_active).toBe(0)
    expect(d.profit_luna).toBe(0)
    expect(d.de_incasat).toBe(0)
  })
})
