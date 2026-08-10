import { app } from 'electron'
import { join } from 'path'
import { getDb, getDbPath, closeDb, getOpenDb } from './db/connection'
import {
  BACKUP_PREFIX,
  creeazaBackup,
  restaureazaBackup,
  reparaAtasamenteIntrerupte,
  rotesteFolder,
  type BackupPaths
} from './backup-core'
import { versiuneSchemaAplicatie } from './db/migrate'

// Folderul gestionat în care copiem atașamentele (inclus în backup).
export function attachmentsDir(): string {
  return join(app.getPath('userData'), 'atasamente')
}

function paths(): BackupPaths {
  return { dbPath: getDbPath(), attachmentsDir: attachmentsDir() }
}

// Backup sincron: snapshot consistent al bazei (VACUUM INTO) + atașamentele.
export function backupToSync(folder: string): string {
  return creeazaBackup(getDb(), paths(), folder)
}

// Păstrează doar cele mai recente `keep` backupuri din folder.
export function rotateBackups(folder: string, keep = 10): void {
  rotesteFolder(folder, BACKUP_PREFIX, keep)
}

// Restaurare: validează backupul, salvează un snapshot de siguranță al datelor
// curente, apoi înlocuiește baza + atașamentele. Necesită repornirea aplicației.
export function restoreFromSync(backupFolder: string): void {
  restaureazaBackup(
    backupFolder,
    paths(),
    join(app.getPath('userData'), 'pre-restaurare'),
    { getOpenDb, closeDb },
    // Un backup făcut de o versiune mai nouă trebuie refuzat înainte de a
    // atinge ceva: altfel aplicația ar refuza la pornire baza restaurată, iar
    // datele vechi ar fi deja suprascrise.
    versiuneSchemaAplicatie()
  )
}

// Repară o restaurare întreruptă între cele două redenumiri ale atașamentelor.
export function reparaAtasamente(): void {
  reparaAtasamenteIntrerupte(attachmentsDir())
}
