import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import { runMigrations, versiuneSchemaAplicatie, versiuneSchemaFisier } from './migrate'
import { snapshotDb, rotesteFolder, timestamp } from '../backup-core'

let db: Database.Database | null = null
let seInchide = false

export function getDbPath(): string {
  return join(app.getPath('userData'), 'catastif.db')
}

// Copii de siguranță făcute automat înainte de o migrație de schemă.
export function preActualizareDir(): string {
  return join(app.getPath('userData'), 'pre-actualizare')
}

// Datele utilizatorului trebuie să supraviețuiască oricărei actualizări.
// Ele stau în userData (`%APPDATA%\catastif` pe Windows), care nu este atins
// nici de instalator, nici de dezinstalare (`deleteAppDataOnUninstall: false`).
// Ce rămâne de protejat este momentul în care o versiune nouă schimbă schema:
//  1. luăm un snapshot consistent al bazei ÎNAINTE de prima migrație, ca o
//     migrație greșită să nu fie un drum fără întoarcere;
//  2. refuzăm să deschidem o bază mai nouă decât codul care rulează — un
//     downgrade care ar scrie cu schema veche peste date noi pierde informație
//     în tăcere, iar un mesaj clar e infinit mai bun decât o coloană lipsă.
function pregatesteSchema(conexiune: Database.Database): void {
  const aFisierului = versiuneSchemaFisier(conexiune)
  const aAplicatiei = versiuneSchemaAplicatie()

  if (aFisierului > aAplicatiei) {
    throw new Error(
      'Datele au fost create de o versiune mai nouă a aplicației Catastif ' +
        `(schema ${aFisierului}, această versiune cunoaște ${aAplicatiei}). ` +
        'Instalează din nou versiunea cea mai recentă — datele tale sunt intacte.'
    )
  }

  // Prima rulare (bază goală) nu are ce pierde: sărim peste snapshot.
  if (aFisierului > 0 && aFisierului < aAplicatiei) {
    const dir = preActualizareDir()
    const dest = join(dir, `catastif-schema${aFisierului}-${timestamp()}.db`)
    snapshotDb(conexiune, dest)
    rotesteFolder(dir, 'catastif-schema', 5)
  }

  runMigrations(conexiune)
}

export function getDb(): Database.Database {
  // În timpul închiderii, un ultim mesaj IPC venit de la interfață ar redeschide
  // baza după `closeDb()` — și ar rămâne deschisă, cu fișiere -wal/-shm în urmă,
  // iar scrierea nu ar mai apuca să intre în backupul tocmai făcut.
  if (seInchide) {
    throw new Error('Aplicația se închide — operațiunea nu mai poate fi executată.')
  }
  if (!db) {
    db = new Database(getDbPath())
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    try {
      pregatesteSchema(db)
    } catch (err) {
      // O bază pe care nu o putem pregăti nu trebuie lăsată deschisă pe jumătate.
      db.close()
      db = null
      throw err
    }
  }
  return db
}

// Conexiunea curentă, fără a deschide una nouă (pentru backup/restaurare).
export function getOpenDb(): Database.Database | null {
  return db
}

export function marcheazaInchiderea(): void {
  seInchide = true
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
