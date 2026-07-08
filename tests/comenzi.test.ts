import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { freshDb } from './helpers'
import { closeDb } from '../src/main/db/connection'
import { createProdus, getProdus } from '../src/main/db/repos/produse'
import {
  createComanda,
  updateComanda,
  acceptaComanda,
  anuleazaComanda,
  inregistreazaPlata,
  deleteComanda,
  getComanda
} from '../src/main/db/repos/comenzi'
import type { LinieComandaInput, ProdusInput } from '../shared/types'

const PRODUS: ProdusInput = {
  nume: 'Fereastră PVC',
  descriere: null,
  unitate_masura: 'buc',
  pret_referinta: 50000,
  cota_tva: 21,
  track_stock: true,
  stoc_curent: 10,
  prag_stoc: 2,
  furnizor_id: null
}

function linie(produsId: number | null, cantitate: number, extra?: Partial<LinieComandaInput>): LinieComandaInput {
  return {
    produs_id: produsId,
    descriere: 'Fereastră PVC 120×150',
    cantitate,
    unitate_masura: 'buc',
    cost_unitar: 30000,
    pret_unitar: 50000,
    cota_tva: 21,
    pozitie: 0,
    ...extra
  }
}

beforeEach(() => freshDb())
afterEach(() => closeDb())

describe('ciclul de viață al comenzii', () => {
  it('creează o ofertă cu număr automat și totaluri persistate', () => {
    const c = createComanda({ numar: null, client_id: null, observatii: null, linii: [linie(null, 2)] })
    expect(c.stare).toBe('oferta')
    expect(c.numar).toBe('C' + String(c.id).padStart(4, '0'))
    expect(c.total_fara_tva).toBe(100000)
    expect(c.total_tva).toBe(21000)
    expect(c.total).toBe(121000)
    expect(c.profit).toBe(40000)
  })

  it('oferta nu mișcă stocul; acceptarea îl scade; anularea îl restituie', () => {
    const p = createProdus(PRODUS)
    const c = createComanda({ numar: null, client_id: null, observatii: null, linii: [linie(p.id, 3)] })
    expect(getProdus(p.id)!.stoc_curent).toBe(10)

    acceptaComanda(c.id)
    expect(getProdus(p.id)!.stoc_curent).toBe(7)

    anuleazaComanda(c.id)
    expect(getProdus(p.id)!.stoc_curent).toBe(10)
  })

  it('anularea repetată nu restituie stocul de două ori și nu schimbă data anulării', () => {
    const p = createProdus(PRODUS)
    const c = createComanda({ numar: null, client_id: null, observatii: null, linii: [linie(p.id, 3)] })
    acceptaComanda(c.id)
    const prima = anuleazaComanda(c.id)
    const aDoua = anuleazaComanda(c.id)
    expect(getProdus(p.id)!.stoc_curent).toBe(10)
    expect(aDoua.data_anulare).toBe(prima.data_anulare)
  })

  it('produsele fără track_stock nu sunt afectate', () => {
    const p = createProdus({ ...PRODUS, track_stock: false, stoc_curent: 0 })
    const c = createComanda({ numar: null, client_id: null, observatii: null, linii: [linie(p.id, 5)] })
    acceptaComanda(c.id)
    expect(getProdus(p.id)!.stoc_curent).toBe(0)
  })
})

describe('updateComanda și stocul', () => {
  it('editarea unei comenzi confirmate ajustează stocul la noile cantități', () => {
    const p = createProdus(PRODUS)
    const c = createComanda({ numar: null, client_id: null, observatii: null, linii: [linie(p.id, 3)] })
    acceptaComanda(c.id)
    expect(getProdus(p.id)!.stoc_curent).toBe(7)

    // Crește cantitatea 3 → 5: stocul trebuie să scadă cu încă 2.
    updateComanda(c.id, { numar: c.numar, client_id: null, observatii: null, linii: [linie(p.id, 5)] })
    expect(getProdus(p.id)!.stoc_curent).toBe(5)

    // Scoate produsul de pe linie: stocul revine complet.
    updateComanda(c.id, { numar: c.numar, client_id: null, observatii: null, linii: [linie(null, 5)] })
    expect(getProdus(p.id)!.stoc_curent).toBe(10)
  })

  it('editarea unei oferte nu mișcă stocul', () => {
    const p = createProdus(PRODUS)
    const c = createComanda({ numar: null, client_id: null, observatii: null, linii: [linie(p.id, 3)] })
    updateComanda(c.id, { numar: c.numar, client_id: null, observatii: null, linii: [linie(p.id, 8)] })
    expect(getProdus(p.id)!.stoc_curent).toBe(10)
  })
})

describe('plăți', () => {
  it('prima plată transformă oferta în comandă și scade stocul', () => {
    const p = createProdus(PRODUS)
    const c = createComanda({ numar: null, client_id: null, observatii: null, linii: [linie(p.id, 2)] })
    const dupa = inregistreazaPlata(c.id, 50000)
    expect(dupa.stare).toBe('comanda')
    expect(dupa.achitat).toBe(50000)
    expect(dupa.rest_de_plata).toBe(dupa.total - 50000)
    expect(getProdus(p.id)!.stoc_curent).toBe(8)
  })

  it('plățile pe o comandă anulată sunt respinse', () => {
    const c = createComanda({ numar: null, client_id: null, observatii: null, linii: [linie(null, 1)] })
    anuleazaComanda(c.id)
    expect(() => inregistreazaPlata(c.id, 1000)).toThrow(/anulată/)
  })

  it('o corecție negativă nu duce achitatul sub zero', () => {
    const c = createComanda({ numar: null, client_id: null, observatii: null, linii: [linie(null, 1)] })
    inregistreazaPlata(c.id, 10000)
    const dupa = inregistreazaPlata(c.id, -99999)
    expect(dupa.achitat).toBe(0)
  })
})

describe('deleteComanda', () => {
  it('șterge o ofertă împreună cu liniile ei', () => {
    const c = createComanda({ numar: null, client_id: null, observatii: null, linii: [linie(null, 1)] })
    deleteComanda(c.id)
    expect(getComanda(c.id)).toBeUndefined()
  })

  it('refuză ștergerea unei comenzi confirmate (stocul ar rămâne greșit)', () => {
    const p = createProdus(PRODUS)
    const c = createComanda({ numar: null, client_id: null, observatii: null, linii: [linie(p.id, 3)] })
    acceptaComanda(c.id)
    expect(() => deleteComanda(c.id)).toThrow(/anulează/)
    expect(getComanda(c.id)).toBeDefined()
    expect(getProdus(p.id)!.stoc_curent).toBe(7)
  })

  it('refuză ștergerea unei comenzi anulate (istoric)', () => {
    const c = createComanda({ numar: null, client_id: null, observatii: null, linii: [linie(null, 1)] })
    anuleazaComanda(c.id)
    expect(() => deleteComanda(c.id)).toThrow()
  })
})
