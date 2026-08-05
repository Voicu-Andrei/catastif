import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs'
import Database from 'better-sqlite3'
import { freshDb, testUserData } from './helpers'
import { closeDb, getDb } from '../src/main/db/connection'
import { resetBaza, folderPreStergere } from '../src/main/db/reset'
import { getSetari, saveSetari } from '../src/main/db/repos/setari'
import { createClient } from '../src/main/db/repos/clienti'
import { createFurnizor } from '../src/main/db/repos/furnizori'
import { createProdus, listProduse } from '../src/main/db/repos/produse'
import {
  createComanda,
  inregistreazaPlata,
  listComenzi,
  acceptaComanda
} from '../src/main/db/repos/comenzi'
import { createAchizitie } from '../src/main/db/repos/achizitii'

function seed(): void {
  const f = createFurnizor({
    nume: 'SC Profil SRL',
    cui: null,
    nr_reg_com: null,
    adresa: null,
    telefon: null,
    email: null,
    note: null
  })
  const p = createProdus({
    nume: 'Fereastră PVC',
    descriere: null,
    unitate_masura: 'buc',
    pret_referinta: 50000,
    cota_tva: 21,
    track_stock: true,
    stoc_curent: 10,
    prag_stoc: 2,
    furnizor_id: f.id
  })
  const cl = createClient({
    tip: 'firma',
    nume: 'SC Geam SRL',
    cui: 'RO123',
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
  const c = createComanda({
    numar: null,
    client_id: cl.id,
    observatii: null,
    linii: [
      {
        produs_id: p.id,
        descriere: 'Fereastră',
        cantitate: 2,
        unitate_masura: 'buc',
        cost_unitar: 30000,
        pret_unitar: 50000,
        cota_tva: 21,
        pozitie: 0
      }
    ]
  })
  acceptaComanda(c.id)
  inregistreazaPlata(c.id, 20000)
  createAchizitie({
    furnizor_id: f.id,
    data: '2026-07-01',
    numar_document: 'F123',
    observatii: null,
    linii: [
      {
        produs_id: p.id,
        descriere: 'Fereastră',
        cantitate: 5,
        unitate_masura: 'buc',
        cost_unitar: 30000,
        data: '2026-07-01'
      }
    ]
  })
}

const numara = (tabel: string): number =>
  (getDb().prepare(`SELECT COUNT(*) c FROM ${tabel}`).get() as { c: number }).c

beforeEach(() => freshDb())
afterEach(() => closeDb())

describe('ștergerea datelor (pornire de la zero)', () => {
  it('golește toate registrele', () => {
    seed()
    expect(numara('comenzi')).toBe(1)
    expect(numara('plati')).toBe(1)

    resetBaza()

    for (const t of [
      'produse',
      'clienti',
      'furnizori',
      'comenzi',
      'linii_comanda',
      'achizitii',
      'linii_achizitie',
      'plati',
      'facturi',
      'fisiere'
    ]) {
      expect(numara(t), `tabela ${t}`).toBe(0)
    }
    expect(listProduse()).toEqual([])
    expect(listComenzi()).toEqual([])
  })

  it('păstrează datele firmei — nu se retastează CUI-ul și logo-ul', () => {
    saveSetari({
      nume_firma: 'Light Plast Design',
      cui: 'RO12345',
      logo_path: '_firma/logo.png',
      backup_folder: '/undeva/backup',
      cota_tva_implicita: 11
    })
    seed()
    resetBaza()

    const s = getSetari()
    expect(s.nume_firma).toBe('Light Plast Design')
    expect(s.cui).toBe('RO12345')
    expect(s.logo_path).toBe('_firma/logo.png')
    expect(s.backup_folder).toBe('/undeva/backup')
    expect(s.cota_tva_implicita).toBe(11)
  })

  it('face o copie de siguranță ÎNAINTE de ștergere, din care datele se pot recupera', () => {
    seed()
    const copie = resetBaza()

    expect(existsSync(copie)).toBe(true)
    expect(copie.startsWith(folderPreStergere())).toBe(true)

    // Copia chiar conține datele de dinainte.
    const veche = new Database(copie, { readonly: true })
    expect((veche.prepare('SELECT COUNT(*) c FROM comenzi').get() as { c: number }).c).toBe(1)
    expect((veche.prepare('SELECT nume FROM clienti').get() as { nume: string }).nume).toBe(
      'SC Geam SRL'
    )
    veche.close()
  })

  it('numerotarea reîncepe de la 1', () => {
    seed()
    resetBaza()
    const c = createComanda({
      numar: null,
      client_id: null,
      observatii: null,
      linii: [
        {
          produs_id: null,
          descriere: 'X',
          cantitate: 1,
          unitate_masura: 'buc',
          cost_unitar: 0,
          pret_unitar: 100,
          cota_tva: 21,
          pozitie: 0
        }
      ]
    })
    expect(c.id).toBe(1)
    expect(c.numar).toBe('C0001')
    expect(getSetari().numar_factura_curent).toBe(1)
  })

  it('șterge atașamentele de pe disc, dar păstrează logo-ul firmei', () => {
    const att = join(testUserData(), 'atasamente')
    mkdirSync(join(att, 'client', '1'), { recursive: true })
    writeFileSync(join(att, 'client', '1', 'contract.pdf'), 'pdf')
    mkdirSync(join(att, '_firma'), { recursive: true })
    writeFileSync(join(att, '_firma', 'logo.png'), 'png')

    resetBaza()

    expect(existsSync(join(att, 'client'))).toBe(false)
    expect(existsSync(join(att, '_firma', 'logo.png'))).toBe(true)
  })

  it('funcționează și pe o bază deja goală (fără erori)', () => {
    expect(() => resetBaza()).not.toThrow()
    expect(numara('comenzi')).toBe(0)
  })

  it('păstrează cel mult 5 copii de siguranță', () => {
    for (let i = 0; i < 7; i++) resetBaza()
    const copii = readdirSync(folderPreStergere()).filter((n) =>
      n.startsWith('inainte-de-stergere-')
    )
    expect(copii.length).toBeLessThanOrEqual(5)
  })

  it('baza rămâne utilizabilă imediat după ștergere', () => {
    seed()
    resetBaza()
    expect(getDb().pragma('integrity_check', { simple: true })).toBe('ok')
    const f = createFurnizor({
      nume: 'Furnizor nou',
      cui: null,
      nr_reg_com: null,
      adresa: null,
      telefon: null,
      email: null,
      note: null
    })
    expect(f.id).toBe(1)
  })
})
