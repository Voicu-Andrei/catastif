import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, copyFileSync, cpSync, readdirSync, statSync, rmSync } from 'fs'
import { getDb, getDbPath, closeDb } from './db/connection'

// Folderul gestionat în care copiem atașamentele (inclus în backup).
export function attachmentsDir(): string {
  return join(app.getPath('userData'), 'atasamente')
}

const PREFIX = 'catastif-backup-'

function timestamp(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`
}

// Backup sincron: checkpoint WAL, apoi copiază baza + atașamentele într-un folder cu dată.
export function backupToSync(folder: string): string {
  const db = getDb()
  db.pragma('wal_checkpoint(TRUNCATE)')

  const dest = join(folder, `${PREFIX}${timestamp()}`)
  mkdirSync(dest, { recursive: true })
  copyFileSync(getDbPath(), join(dest, 'catastif.db'))

  const att = attachmentsDir()
  if (existsSync(att)) {
    cpSync(att, join(dest, 'atasamente'), { recursive: true })
  }
  return dest
}

// Păstrează doar cele mai recente `keep` backupuri din folder.
export function rotateBackups(folder: string, keep = 10): void {
  if (!existsSync(folder)) return
  const dirs = readdirSync(folder)
    .filter((n) => n.startsWith(PREFIX))
    .map((n) => ({ n, t: statSync(join(folder, n)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  for (const d of dirs.slice(keep)) {
    rmSync(join(folder, d.n), { recursive: true, force: true })
  }
}

// Restaurare: înlocuiește baza curentă și atașamentele cu cele dintr-un folder de backup.
// Necesită repornirea aplicației pentru a reîncărca datele.
export function restoreFromSync(backupFolder: string): void {
  const sursaDb = join(backupFolder, 'catastif.db')
  if (!existsSync(sursaDb)) {
    throw new Error('Folderul selectat nu conține un backup valid (lipsește catastif.db).')
  }
  closeDb()
  copyFileSync(sursaDb, getDbPath())

  const sursaAtt = join(backupFolder, 'atasamente')
  const att = attachmentsDir()
  if (existsSync(sursaAtt)) {
    if (existsSync(att)) rmSync(att, { recursive: true, force: true })
    cpSync(sursaAtt, att, { recursive: true })
  }
}
