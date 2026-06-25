import type { Database } from 'better-sqlite3'
import { MIGRATIONS } from './migrations'

// Aplică migrațiile neexecutate, în ordine, fiecare într-o tranzacție.
export function runMigrations(db: Database): void {
  const current = db.pragma('user_version', { simple: true }) as number
  const pending = MIGRATIONS.filter((m) => m.version > current).sort((a, b) => a.version - b.version)

  for (const m of pending) {
    const apply = db.transaction(() => {
      db.exec(m.sql)
      db.pragma(`user_version = ${m.version}`)
    })
    apply()
  }
}
