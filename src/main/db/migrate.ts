import type { Database } from 'better-sqlite3'
import { MIGRATIONS } from './migrations'

// Cea mai mare versiune de schemă pe care o cunoaște codul care rulează acum.
export function versiuneSchemaAplicatie(): number {
  return MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0)
}

// Versiunea de schemă cu care a fost scris fișierul de pe disc.
export function versiuneSchemaFisier(db: Database): number {
  return db.pragma('user_version', { simple: true }) as number
}

// Aplică migrațiile neexecutate, în ordine, fiecare într-o tranzacție.
export function runMigrations(db: Database): void {
  const current = versiuneSchemaFisier(db)
  const pending = MIGRATIONS.filter((m) => m.version > current).sort(
    (a, b) => a.version - b.version
  )

  for (const m of pending) {
    const apply = db.transaction(() => {
      db.exec(m.sql)
      db.pragma(`user_version = ${m.version}`)
    })
    apply()
  }
}
