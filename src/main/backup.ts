import { app } from 'electron'
import { join } from 'path'
import { getDb, getDbPath, closeDb, getOpenDb } from './db/connection'
import {
  BACKUP_PREFIX,
  creeazaBackup,
  restaureazaBackup,
  rotesteFolder,
  type BackupPaths
} from './backup-core'

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
  restaureazaBackup(backupFolder, paths(), join(app.getPath('userData'), 'pre-restaurare'), {
    getOpenDb,
    closeDb
  })
}
