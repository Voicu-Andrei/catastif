import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { join, basename } from 'path'
import { mkdtempSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import Database from 'better-sqlite3'
import { freshDb, testUserData } from './helpers'
import { getDb, getDbPath, getOpenDb, closeDb } from '../src/main/db/connection'
import { createClient } from '../src/main/db/repos/clienti'
import {
  creeazaBackup,
  restaureazaBackup,
  rotesteFolder,
  valideazaBackupDb,
  reparaAtasamenteIntrerupte,
  BACKUP_PREFIX,
  type BackupPaths
} from '../src/main/backup-core'

const tempDir = (): string => mkdtempSync(join(tmpdir(), 'catastif-bk-'))

function paths(): BackupPaths {
  return { dbPath: getDbPath(), attachmentsDir: join(testUserData(), 'atasamente') }
}

beforeEach(() => freshDb())
afterEach(() => closeDb())

describe('backup + restaurare', () => {
  it('round-trip: datele din backup înlocuiesc datele curente', () => {
    const clientVechi = createClient({
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
    const folder = tempDir()
    const dest = creeazaBackup(getDb(), paths(), folder)
    expect(existsSync(join(dest, 'catastif.db'))).toBe(true)

    // Modificăm datele după backup…
    createClient({
      tip: 'persoana',
      nume: 'Ion Popescu',
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
    expect(getDb().prepare('SELECT COUNT(*) c FROM clienti').get()).toEqual({ c: 2 })

    // …și restaurăm.
    restaureazaBackup(dest, paths(), join(testUserData(), 'pre-restaurare'), {
      getOpenDb,
      closeDb
    })
    const db = getDb() // redeschide baza restaurată
    expect(db.prepare('SELECT COUNT(*) c FROM clienti').get()).toEqual({ c: 1 })
    expect(db.prepare('SELECT nume FROM clienti').get()).toEqual({ nume: clientVechi.nume })
  })

  it('face un snapshot de siguranță al datelor curente înainte de restaurare', () => {
    const folder = tempDir()
    const dest = creeazaBackup(getDb(), paths(), folder)
    const safety = join(testUserData(), 'pre-restaurare')
    restaureazaBackup(dest, paths(), safety, { getOpenDb, closeDb })
    const snapshoturi = readdirSync(safety).filter((n) => n.startsWith('pre-restaurare-'))
    expect(snapshoturi.length).toBe(1)
    valideazaBackupDb(join(safety, snapshoturi[0])) // snapshotul e o bază validă
  })

  it('șterge fișierele WAL rămase, ca jurnalul vechi să nu fie rejucat peste baza restaurată', () => {
    const folder = tempDir()
    const dest = creeazaBackup(getDb(), paths(), folder)
    closeDb()
    // Simulăm un WAL rămas de la o închidere murdară.
    writeFileSync(`${getDbPath()}-wal`, 'jurnal vechi')
    writeFileSync(`${getDbPath()}-shm`, 'shm vechi')
    restaureazaBackup(dest, paths(), join(testUserData(), 'pre-restaurare'), {
      getOpenDb,
      closeDb
    })
    expect(existsSync(`${getDbPath()}-wal`)).toBe(false)
    expect(existsSync(`${getDbPath()}-shm`)).toBe(false)
    expect(getDb().pragma('integrity_check', { simple: true })).toBe('ok')
  })

  it('respinge un folder fără catastif.db fără să atingă datele curente', () => {
    createClient({
      tip: 'persoana',
      nume: 'Maria',
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
    expect(() =>
      restaureazaBackup(tempDir(), paths(), join(testUserData(), 'pre-restaurare'), {
        getOpenDb,
        closeDb
      })
    ).toThrow(/backup valid/)
    expect(getDb().prepare('SELECT COUNT(*) c FROM clienti').get()).toEqual({ c: 1 })
  })

  it('respinge un fișier care nu este bază SQLite', () => {
    const folder = tempDir()
    writeFileSync(join(folder, 'catastif.db'), 'nu sunt o bază de date')
    expect(() => valideazaBackupDb(join(folder, 'catastif.db'))).toThrow(/SQLite/)
  })

  it('respinge o bază SQLite care nu are schema Catastif', () => {
    const folder = tempDir()
    const alta = new Database(join(folder, 'catastif.db'))
    alta.exec('CREATE TABLE altceva (id INTEGER)')
    alta.close()
    expect(() => valideazaBackupDb(join(folder, 'catastif.db'))).toThrow(/Catastif/)
  })

  it('include și restaurează atașamentele', () => {
    const att = join(testUserData(), 'atasamente')
    mkdirSync(join(att, 'client', '1'), { recursive: true })
    writeFileSync(join(att, 'client', '1', 'contract.pdf'), 'pdf')
    const dest = creeazaBackup(getDb(), paths(), tempDir())
    expect(existsSync(join(dest, 'atasamente', 'client', '1', 'contract.pdf'))).toBe(true)
  })

  it('rotația păstrează doar cele mai recente backupuri', () => {
    const folder = tempDir()
    for (let i = 0; i < 4; i++) {
      const d = join(folder, `${BACKUP_PREFIX}2026010${i + 1}-000000`)
      mkdirSync(d)
    }
    rotesteFolder(folder, BACKUP_PREFIX, 2)
    expect(readdirSync(folder).length).toBe(2)
  })

  it('un backup reușit lasă în urmă exact un folder, cel definitiv', () => {
    const folder = tempDir()
    const dest = creeazaBackup(getDb(), paths(), folder)
    expect(readdirSync(folder)).toEqual([basename(dest)])
  })

  it('cât timp scrie, pe disc nu există nimic care să pară un backup terminat', () => {
    // Aceasta este chiar rațiunea scrierii în doi pași. Un backup întrerupt de
    // o închidere forțată nu trece prin niciun `catch` — nimic nu apucă să facă
    // curat. Singura apărare e ca, în clipa aceea, folderul pe disc să NU poarte
    // prefixul backupurilor, altfel rotația l-ar socoti valid și ar șterge în
    // locul lui unul vechi, dar bun. Surprindem exact acea clipă.
    const folder = tempDir()
    let inTimpulScrierii: string[] = []

    const dbSpion = {
      prepare: () => ({
        run: (destFile: string) => {
          inTimpulScrierii = readdirSync(folder)
          writeFileSync(destFile, 'snapshot')
        }
      })
    } as unknown as Database.Database

    creeazaBackup(dbSpion, paths(), folder)

    expect(inTimpulScrierii.filter((n) => n.startsWith(BACKUP_PREFIX))).toEqual([])
    expect(inTimpulScrierii.some((n) => n.startsWith('in-lucru-'))).toBe(true)
  })

  it('un backup eșuat nu lasă nimic în urmă și nu ocupă un loc la rotație', () => {
    // Forțăm eșecul chiar în interiorul lui `creeazaBackup`, la snapshot: e
    // echivalentul unui disc plin sau al unui stick scos. Un backup tăiat la
    // jumătate NU trebuie să rămână sub un nume care începe cu prefixul
    // backupurilor, altfel rotația l-ar socoti printre cele păstrate și ar
    // șterge în locul lui unul vechi, dar valid.
    const folder = tempDir()
    const bunAnterior = creeazaBackup(getDb(), paths(), folder)

    const dbCareEsueaza = {
      prepare: () => ({
        run: () => {
          throw new Error('database or disk is full')
        }
      })
    } as unknown as Database.Database

    expect(() => creeazaBackup(dbCareEsueaza, paths(), folder)).toThrow(/disk is full/)

    // Singurul folder rămas este backupul bun de dinainte: nici rest de lucru,
    // nici un al doilea folder cu prefixul de backup.
    expect(readdirSync(folder)).toEqual([basename(bunAnterior)])

    // Și, ca urmare, rotația nu are ce evicta greșit.
    rotesteFolder(folder, BACKUP_PREFIX, 1)
    expect(readdirSync(folder)).toEqual([basename(bunAnterior)])
  })

  it('curăță resturile unei încercări întrerupte brutal', () => {
    // Aici aplicația a fost omorâtă înainte să apuce să-și șteargă folderul de
    // lucru. Nimeni altcineva nu l-ar mai șterge vreodată — rotația îl ignoră
    // tocmai pentru că nu poartă prefixul backupurilor.
    const folder = tempDir()
    mkdirSync(join(folder, 'in-lucru-20260101-000000'), { recursive: true })
    writeFileSync(join(folder, 'in-lucru-20260101-000000', 'catastif.db'), 'pe jumătate')

    creeazaBackup(getDb(), paths(), folder)

    expect(readdirSync(folder).filter((n) => n.startsWith('in-lucru-'))).toEqual([])
  })

  it('repară atașamentele rămase fără folder după o restaurare întreruptă', () => {
    // Între cele două redenumiri există o clipă în care folderul de atașamente
    // nu există sub niciun nume final. O pană de curent exact atunci ar face ca
    // toate atașamentele să pară dispărute de pe disc, deși sunt acolo.
    const att = join(testUserData(), 'atasamente')
    rmSync(att, { recursive: true, force: true })
    mkdirSync(join(`${att}.nou`, 'client', '1'), { recursive: true })
    writeFileSync(join(`${att}.nou`, 'client', '1', 'contract.pdf'), 'pdf')

    reparaAtasamenteIntrerupte(att)

    expect(existsSync(join(att, 'client', '1', 'contract.pdf'))).toBe(true)
    expect(existsSync(`${att}.nou`)).toBe(false)
  })

  it('nu atinge atașamentele existente când nu e nimic de reparat', () => {
    const att = join(testUserData(), 'atasamente')
    mkdirSync(att, { recursive: true })
    writeFileSync(join(att, 'martor.txt'), 'original')
    mkdirSync(`${att}.vechi`, { recursive: true })

    reparaAtasamenteIntrerupte(att)

    expect(existsSync(join(att, 'martor.txt'))).toBe(true)
  })

  it('refuză un backup făcut de o versiune mai nouă, înainte să atingă ceva', () => {
    // Altfel ar fi un drum fără întoarcere: baza restaurată e mai nouă decât
    // aplicația, care de la următoarea pornire refuză să o deschidă — iar datele
    // vechi au fost deja suprascrise.
    const folder = tempDir()
    const backup = creeazaBackup(getDb(), paths(), folder)
    const b = new Database(join(backup, 'catastif.db'))
    b.pragma('user_version = 999')
    b.close()

    expect(() => valideazaBackupDb(join(backup, 'catastif.db'), 2)).toThrow(/versiune mai nouă/i)
    // Fără limită de schemă, validarea rămâne cea dinainte.
    expect(() => valideazaBackupDb(join(backup, 'catastif.db'))).not.toThrow()
  })

  it('două backupuri în aceeași secundă nu se contopesc', () => {
    const folder = tempDir()
    const unu = creeazaBackup(getDb(), paths(), folder)
    const doi = creeazaBackup(getDb(), paths(), folder)

    expect(unu).not.toBe(doi)
    expect(readdirSync(folder).filter((n) => n.startsWith(BACKUP_PREFIX))).toHaveLength(2)
  })

  it('o restaurare eșuată lasă baza curentă neatinsă', () => {
    // Cazul real: stick scos, disc plin sau antivirus care blochează fișierul la
    // jumătatea copierii. Varianta veche scria direct peste baza curentă și o
    // pierdea; acum copiem alături și redenumim doar la final.
    createClient({
      tip: 'firma',
      nume: 'Firma Curentă',
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

    const backupBun = creeazaBackup(getDb(), paths(), tempDir())

    // Facem copierea să eșuege sigur și portabil: destinația este un folder, iar
    // `copyFileSync` peste un folder dă EISDIR. Este echivalentul unei copieri
    // care cade la jumătate din motive de sistem de fișiere.
    const dest = tempDir()
    const caleBlocata = join(dest, 'catastif.db')
    mkdirSync(caleBlocata)
    writeFileSync(join(caleBlocata, 'martor.txt'), 'nu mă atinge')

    expect(() =>
      restaureazaBackup(
        backupBun,
        { dbPath: caleBlocata, attachmentsDir: join(dest, 'atasamente') },
        join(testUserData(), 'pre'),
        { getOpenDb, closeDb }
      )
    ).toThrow(/neatinse/i)

    // „Baza” de la destinație a rămas exact cum era…
    expect(existsSync(join(caleBlocata, 'martor.txt'))).toBe(true)
    // …și nu a rămas niciun fișier temporar în urmă.
    expect(existsSync(`${caleBlocata}.nou`)).toBe(false)

    // Iar baza reală a aplicației, deschisă din nou, are datele nealterate.
    const db = getDb()
    expect(db.prepare('SELECT nume FROM clienti').pluck().all()).toEqual(['Firma Curentă'])
  })
})
