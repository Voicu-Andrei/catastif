import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import { runMigrations } from './migrate'

let db: Database.Database | null = null

export function getDbPath(): string {
  return join(app.getPath('userData'), 'catastif.db')
}

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath())
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
