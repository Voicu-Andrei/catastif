// Logica de backup/restaurare fără dependențe de Electron, ca să poată fi
// testată direct pe fișiere temporare. `backup.ts` o leagă la căile aplicației.

import { join, dirname } from 'path'
import { existsSync, mkdirSync, cpSync, readdirSync, statSync, rmSync, copyFileSync } from 'fs'
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
    throw new Error(
      msg.startsWith('Fișierul') || msg.startsWith('Folderul')
        ? msg
        : 'Fișierul de backup nu poate fi citit ca bază de date SQLite.'
    )
  } finally {
    db?.close()
  }
}

export interface BackupPaths {
  dbPath: string
  attachmentsDir: string
}

// Creează un folder de backup datat: baza (snapshot consistent) + atașamentele.
export function creeazaBackup(db: Database.Database, paths: BackupPaths, folder: string): string {
  const dest = join(folder, `${BACKUP_PREFIX}${timestamp()}`)
  mkdirSync(dest, { recursive: true })
  snapshotDb(db, join(dest, 'catastif.db'))
  if (existsSync(paths.attachmentsDir)) {
    cpSync(paths.attachmentsDir, join(dest, 'atasamente'), { recursive: true })
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
  rmSync(`${paths.dbPath}-wal`, { force: true })
  rmSync(`${paths.dbPath}-shm`, { force: true })
  copyFileSync(sursaDb, paths.dbPath)

  const sursaAtt = join(backupFolder, 'atasamente')
  if (existsSync(sursaAtt)) {
    if (existsSync(paths.attachmentsDir)) rmSync(paths.attachmentsDir, { recursive: true, force: true })
    cpSync(sursaAtt, paths.attachmentsDir, { recursive: true })
  }
}
