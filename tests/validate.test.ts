import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { freshDb } from './helpers'
import { closeDb } from '../src/main/db/connection'
import { createProdus } from '../src/main/db/repos/produse'
import { createClient, deleteClient } from '../src/main/db/repos/clienti'
import { createFurnizor, deleteFurnizor } from '../src/main/db/repos/furnizori'
import { createComanda } from '../src/main/db/repos/comenzi'
import { createAchizitie } from '../src/main/db/repos/achizitii'
import type { ClientInput, FurnizorInput, LinieComandaInput } from '../shared/types'

const CLIENT: ClientInput = {
  tip: 'persoana',
  nume: 'Ion',
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
}
const FURNIZOR: FurnizorInput = {
  nume: 'SC Profil SRL',
  cui: null,
  nr_reg_com: null,
  adresa: null,
  telefon: null,
  email: null,
  note: null
}
const LINIE: LinieComandaInput = {
  produs_id: null,
  descriere: 'Fereastră',
  cantitate: 1,
  unitate_masura: 'buc',
  cost_unitar: 100,
  pret_unitar: 200,
  cota_tva: 21,
  pozitie: 0
}

beforeEach(() => freshDb())
afterEach(() => closeDb())

describe('validare la granița main', () => {
  it('respinge produse fără nume sau cu valori negative', () => {
    const bun = {
      nume: 'P',
      descriere: null,
      unitate_masura: 'buc',
      cost_referinta: null,
      pret_referinta: null,
      cota_tva: 21,
      track_stock: false,
      stoc_curent: 0,
      prag_stoc: null,
      furnizor_id: null
    }
    expect(() => createProdus({ ...bun, nume: '  ' })).toThrow(/obligatoriu/)
    expect(() => createProdus({ ...bun, cota_tva: 150 })).toThrow(/TVA/)
    expect(() => createProdus({ ...bun, pret_referinta: -5 })).toThrow(/negativ/)
    expect(() => createProdus({ ...bun, stoc_curent: -1 })).toThrow(/negativ/)
  })

  it('respinge comenzi fără linii sau cu linii invalide', () => {
    const gol = { numar: null, client_id: null, observatii: null }
    expect(() => createComanda({ ...gol, linii: [] })).toThrow(/cel puțin o linie/)
    expect(() => createComanda({ ...gol, linii: [{ ...LINIE, cantitate: 0 }] })).toThrow(
      /cantitatea/
    )
    expect(() => createComanda({ ...gol, linii: [{ ...LINIE, cantitate: NaN }] })).toThrow(
      /cantitatea/
    )
    expect(() => createComanda({ ...gol, linii: [{ ...LINIE, pret_unitar: -1 }] })).toThrow(
      /negativ/
    )
    expect(() =>
      createComanda({ ...gol, linii: [{ ...LINIE, descriere: '', produs_id: null }] })
    ).toThrow(/descriere/)
  })

  it('respinge achiziții cu dată invalidă', () => {
    expect(() =>
      createAchizitie({
        furnizor_id: null,
        data: 'ieri',
        numar_document: null,
        observatii: null,
        linii: [
          {
            produs_id: null,
            descriere: 'X',
            cantitate: 1,
            unitate_masura: 'buc',
            cost_unitar: 1,
            data: 'ieri'
          }
        ]
      })
    ).toThrow(/Data/)
  })

  it('clientul cu comenzi nu poate fi șters, dar unul liber da', () => {
    const cu = createClient(CLIENT)
    const liber = createClient({ ...CLIENT, nume: 'Maria' })
    createComanda({ numar: null, client_id: cu.id, observatii: null, linii: [LINIE] })
    expect(() => deleteClient(cu.id)).toThrow(/comenzi asociate/)
    expect(() => deleteClient(liber.id)).not.toThrow()
  })

  it('furnizorul cu achiziții nu poate fi șters', () => {
    const f = createFurnizor(FURNIZOR)
    createAchizitie({
      furnizor_id: f.id,
      data: '2026-07-01',
      numar_document: null,
      observatii: null,
      linii: [
        {
          produs_id: null,
          descriere: 'X',
          cantitate: 1,
          unitate_masura: 'buc',
          cost_unitar: 1,
          data: '2026-07-01'
        }
      ]
    })
    expect(() => deleteFurnizor(f.id)).toThrow(/achiziții asociate/)
  })
})
