// Logica de backup/restaurare fără dependențe de Electron, ca să poată fi
// testată direct pe fișiere temporare. `backup.ts` o leagă la căile aplicației.

import { join, dirname } from 'path'
import {
  existsSync,
  mkdirSync,
  cpSync,
  readdirSync,
  statSync,
  rmSync,
  copyFileSync,
  renameSync
} from 'fs'
import Database from 'better-sqlite3'

export const BACKUP_PREFIX = 'catastif-backup-'

export function timestamp(d = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`
}

// Copie consistentă a bazei deschise, indiferent de starea WAL.
// VACUUM INTO produce un snapshot atomic; destinația nu trebuie să existe.
export function snapshotDb(db: Database.Database, destFile: string): void {
  mkdirSync(dirname(destFile), { recursive: true })
  if (existsSync(destFile)) rmSync(destFile, { force: true })
  db.prepare('VACUUM INTO ?').run(destFile)
}

// Verifică faptul că fișierul este o bază SQLite validă și pare a fi una Catastif.
// Aruncă o eroare (în română) dacă nu — datele curente rămân neatinse.
export function valideazaBackupDb(file: string): void {
  if (!existsSync(file)) {
    throw new Error('Folderul selectat nu conține un backup valid (lipsește catastif.db).')
  }
  let db: Database.Database | null = null
  try {
    db = new Database(file, { readonly: true, fileMustExist: true })
    const integ = db.pragma('integrity_check', { simple: true }) as string
    if (integ !== 'ok') {
      throw new Error('Fișierul de backup este deteriorat (verificarea integrității a eșuat).')
    }
    const r = db
      .prepare(
        `SELECT COUNT(*) AS c FROM sqlite_master
         WHERE type='table' AND name IN ('setari','clienti','produse','comenzi')`
      )
      .get() as { c: number }
    if (r.c < 4) {
      throw new Error('Fișierul selectat nu pare a fi o bază de date Catastif.')
    }
  } catch (err) {
    const msg = (err as Error).message
    if (msg.startsWith('Fișierul') || msg.startsWith('Folderul')) throw err
    throw new Error('Fișierul de backup nu poate fi citit ca bază de date SQLite.', {
      cause: err
    })
  } finally {
    db?.close()
  }
}

export interface BackupPaths {
  dbPath: string
  attachmentsDir: string
}

// Creează un folder de backup datat: baza (snapshot consistent) + atașamentele.
//
// Scriem întâi într-un folder de lucru al cărui nume NU începe cu BACKUP_PREFIX,
// și abia la final îi dăm numele definitiv. Altfel un backup întrerupt (aplicația
// închisă forțat, stick scos, OneDrive nesincronizat) rămâne pe disc arătând ca
// un backup bun: `rotesteFolder` l-ar număra printre cele 10 păstrate și ar
// șterge, în locul lui, un backup vechi dar valid.
export function creeazaBackup(db: Database.Database, paths: BackupPaths, folder: string): string {
  // Două backupuri pornite în aceeași secundă (clic dublu pe „Creează backup
  // acum”, sau unul manual peste cel automat) ar ținti același folder: al
  // doilea ar suprascrie baza, dar ar contopi atașamentele, lăsând în backup
  // fișiere deja șterse din aplicație.
  let sufix = timestamp()
  for (let i = 2; existsSync(join(folder, `${BACKUP_PREFIX}${sufix}`)); i++) {
    sufix = `${timestamp()}-${i}`
  }
  const dest = join(folder, `${BACKUP_PREFIX}${sufix}`)
  // Numele de lucru nu trebuie să înceapă cu BACKUP_PREFIX, altfel `rotesteFolder`
  // l-ar confunda cu un backup terminat.
  const lucru = join(folder, `in-lucru-${sufix}`)

  rmSync(lucru, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  mkdirSync(lucru, { recursive: true })
  try {
    snapshotDb(db, join(lucru, 'catastif.db'))
    if (existsSync(paths.attachmentsDir)) {
      cpSync(paths.attachmentsDir, join(lucru, 'atasamente'), { recursive: true })
    }
    // Redenumirea eșuează dacă destinația a apărut între timp — preferăm o
    // eroare vizibilă în locul ștergerii tăcute a unui backup existent.
    renameSync(lucru, dest)
  } catch (err) {
    rmSync(lucru, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    throw err
  }
  return dest
}

// Păstrează doar cele mai recente `keep` intrări cu prefixul dat din folder.
export function rotesteFolder(folder: string, prefix: string, keep: number): void {
  if (!existsSync(folder)) return
  const intrari = readdirSync(folder)
    .filter((n) => n.startsWith(prefix))
    .map((n) => ({ n, t: statSync(join(folder, n)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  for (const d of intrari.slice(keep)) {
    rmSync(join(folder, d.n), { recursive: true, force: true })
  }
}

export interface RestoreHooks {
  // Baza curentă (dacă e deschisă) — folosită pentru snapshotul de siguranță.
  getOpenDb: () => Database.Database | null
  // Închide conexiunea curentă înainte de a înlocui fișierul.
  closeDb: () => void
}

// Restaurare sigură:
//  1. validează backupul ales (integritate + schemă) — eșec = datele curente neatinse;
//  2. face un snapshot de siguranță al datelor curente (rotit, max `keepSafety`);
//  3. închide baza, ȘTERGE fișierele WAL/SHM rămase (altfel SQLite ar rejuca
//     jurnalul vechi peste baza restaurată => corupere), apoi copiază backupul;
//  4. înlocuiește atașamentele cu cele din backup.
export function restaureazaBackup(
  backupFolder: string,
  paths: BackupPaths,
  safetyDir: string,
  hooks: RestoreHooks,
  keepSafety = 5
): void {
  const sursaDb = join(backupFolder, 'catastif.db')
  valideazaBackupDb(sursaDb)

  const dbCurenta = hooks.getOpenDb()
  if (dbCurenta && existsSync(paths.dbPath)) {
    snapshotDb(dbCurenta, join(safetyDir, `pre-restaurare-${timestamp()}.db`))
    rotesteFolder(safetyDir, 'pre-restaurare-', keepSafety)
  }

  hooks.closeDb()

  // Copiem lângă baza curentă (deci pe același volum, unde redenumirea este
  // atomică) și abia apoi înlocuim. Dacă discul se umple, stickul e scos sau
  // antivirusul blochează fișierul la jumătatea copierii, baza curentă rămâne
  // exact cum era — varianta veche scria direct peste ea și o pierdea.
  const temporar = `${paths.dbPath}.nou`
  try {
    rmSync(temporar, { force: true })
    copyFileSync(sursaDb, temporar)
    renameSync(temporar, paths.dbPath)
  } catch (err) {
    rmSync(temporar, { force: true })
    throw new Error(
      `Restaurarea nu a putut fi finalizată, iar datele curente au rămas neatinse. (${
        (err as Error).message
      })`,
      { cause: err }
    )
  }

  // Abia după ce baza a fost înlocuită cu succes scăpăm de jurnalul vechi:
  // altfel SQLite l-ar rejuca peste baza restaurată și ar corupe-o.
  rmSync(`${paths.dbPath}-wal`, { force: true })
  rmSync(`${paths.dbPath}-shm`, { force: true })

  const sursaAtt = join(backupFolder, 'atasamente')
  if (existsSync(sursaAtt)) {
    // Aceeași grijă pentru atașamente: construim noul folder complet, apoi
    // schimbăm locurile, ca o copiere eșuată să nu lase utilizatorul fără ele.
    const nou = `${paths.attachmentsDir}.nou`
    const vechi = `${paths.attachmentsDir}.vechi`
    rmSync(nou, { recursive: true, force: true })
    rmSync(vechi, { recursive: true, force: true })
    try {
      cpSync(sursaAtt, nou, { recursive: true })
      if (existsSync(paths.attachmentsDir)) renameSync(paths.attachmentsDir, vechi)
      renameSync(nou, paths.attachmentsDir)
      rmSync(vechi, { recursive: true, force: true })
    } catch (err) {
      rmSync(nou, { recursive: true, force: true })
      // Dacă am apucat să mutăm originalul deoparte, îl punem la loc.
      if (!existsSync(paths.attachmentsDir) && existsSync(vechi)) {
        renameSync(vechi, paths.attachmentsDir)
      }
      throw new Error(
        `Baza de date a fost restaurată, dar atașamentele nu. (${(err as Error).message})`,
        { cause: err }
      )
    }
  }
}
