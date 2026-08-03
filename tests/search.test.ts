import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { freshDb } from './helpers'
import { closeDb } from '../src/main/db/connection'
import { createProdus } from '../src/main/db/repos/produse'
import { searchGlobal } from '../src/main/db/repos/search'

const produs = (nume: string) =>
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
    furnizor_id: null
  })

beforeEach(() => freshDb())
afterEach(() => closeDb())

describe('căutarea globală', () => {
  it('găsește după fragment de nume, indiferent de tip', () => {
    produs('Fereastră PVC')
    produs('Ușă termopan')
    const r = searchGlobal('fereastr')
    expect(r.length).toBe(1)
    expect(r[0].titlu).toBe('Fereastră PVC')
    expect(r[0].link).toMatch(/^\/produse\?edit=\d+$/)
  })

  it('sub 2 caractere nu caută', () => {
    produs('AB')
    expect(searchGlobal('a')).toEqual([])
  })

  it('metacaracterele LIKE din text sunt luate literal', () => {
    produs('Profil 100%')
    produs('Profil 100 lei')
    const r = searchGlobal('100%')
    expect(r.length).toBe(1)
    expect(r[0].titlu).toBe('Profil 100%')
    // „_” nu mai e joker pe un singur caracter
    expect(searchGlobal('Prof_l').length).toBe(0)
  })
})
