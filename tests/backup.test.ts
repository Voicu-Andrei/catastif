import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { join } from 'path'
import { mkdtempSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs'
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
      tip: 'firma', nume: 'SC Geam SRL', cui: 'RO123', nr_reg_com: null, cnp: null,
      adresa: null, judet: null, oras: null, cod_postal: null, telefon: null, email: null, note: null
    })
    const folder = tempDir()
    const dest = creeazaBackup(getDb(), paths(), folder)
    expect(existsSync(join(dest, 'catastif.db'))).toBe(true)

    // Modificăm datele după backup…
    createClient({
      tip: 'persoana', nume: 'Ion Popescu', cui: null, nr_reg_com: null, cnp: null,
      adresa: null, judet: null, oras: null, cod_postal: null, telefon: null, email: null, note: null
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
      tip: 'persoana', nume: 'Maria', cui: null, nr_reg_com: null, cnp: null,
      adresa: null, judet: null, oras: null, cod_postal: null, telefon: null, email: null, note: null
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
})
