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
// `schemaMaxima` este versiunea de schemă pe care o cunoaște aplicația care
// rulează. Un backup mai nou de atât trebuie refuzat AICI, înainte de a atinge
// ceva: odată copiat peste baza curentă, aplicația ar refuza la pornire o bază
// mai nouă decât ea (vezi connection.ts) — un drum fără întoarcere, cu datele
// vechi deja suprascrise.
export function valideazaBackupDb(file: string, schemaMaxima?: number): void {
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
    if (schemaMaxima !== undefined) {
      const schemaBackup = db.pragma('user_version', { simple: true }) as number
      if (schemaBackup > schemaMaxima) {
        throw new Error(
          'Backupul a fost creat de o versiune mai nouă a aplicației Catastif. ' +
            'Actualizează Catastif pe acest calculator, apoi restaurează — ' +
            'datele curente au rămas neatinse.'
        )
      }
    }
  } catch (err) {
    const msg = (err as Error).message
    if (msg.startsWith('Fișierul') || msg.startsWith('Folderul') || msg.startsWith('Backupul')) {
      throw err
    }
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

  // Resturile unei încercări întrerupte brutal (stick scos, aplicație omorâtă)
  // nu sunt șterse de nimeni: rotația le ignoră tocmai pentru că nu poartă
  // prefixul backupurilor. Le strângem aici, altfel se adună la nesfârșit și
  // ajung să umple stickul pe care omul își ține singura copie a afacerii.
  if (existsSync(folder)) {
    for (const nume of readdirSync(folder)) {
      if (nume.startsWith('in-lucru-')) {
        rmSync(join(folder, nume), { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
      }
    }
  }
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
  schemaMaxima?: number,
  keepSafety = 5
): void {
  const sursaDb = join(backupFolder, 'catastif.db')
  valideazaBackupDb(sursaDb, schemaMaxima)

  const dbCurenta = hooks.getOpenDb()
  if (dbCurenta && existsSync(paths.dbPath)) {
    snapshotDb(dbCurenta, join(safetyDir, `pre-restaurare-${timestamp()}.db`))
    rotesteFolder(safetyDir, 'pre-restaurare-', keepSafety)
  }

  hooks.closeDb()

  // Jurnalul WAL aparține conexiunii tocmai închise (SQLite îl consolidează în
  // bază la închidere). Îl ștergem ACUM, cât baza curentă e încă neatinsă:
  // dacă am face-o după înlocuire și ar eșua, jurnalul vechi ar fi rejucat
  // peste baza restaurată și ar corupe-o.
  sterge(`${paths.dbPath}-wal`)
  sterge(`${paths.dbPath}-shm`)

  // Copiem lângă baza curentă (deci pe același volum, unde redenumirea este
  // atomică) și abia apoi înlocuim. Dacă discul se umple, stickul e scos sau
  // antivirusul blochează fișierul la jumătatea copierii, baza curentă rămâne
  // exact cum era — varianta veche scria direct peste ea și o pierdea.
  const temporar = `${paths.dbPath}.nou`
  try {
    sterge(temporar)
    copyFileSync(sursaDb, temporar)
    renameSync(temporar, paths.dbPath)
  } catch (err) {
    sterge(temporar)
    throw new Error(
      `Restaurarea nu a putut fi finalizată, iar datele curente au rămas neatinse. (${
        (err as Error).message
      })`,
      { cause: err }
    )
  }

  const sursaAtt = join(backupFolder, 'atasamente')
  if (existsSync(sursaAtt)) {
    // Aceeași grijă pentru atașamente: construim noul folder complet, apoi
    // schimbăm locurile, ca o copiere eșuată să nu lase utilizatorul fără ele.
    const nou = `${paths.attachmentsDir}.nou`
    const vechi = `${paths.attachmentsDir}.vechi`
    sterge(nou)
    sterge(vechi)
    try {
      cpSync(sursaAtt, nou, { recursive: true })
      if (existsSync(paths.attachmentsDir)) renameSync(paths.attachmentsDir, vechi)
      renameSync(nou, paths.attachmentsDir)
    } catch (err) {
      // Ordinea contează: întâi punem originalul la loc, abia apoi încercăm să
      // strângem resturile. Invers, un `rmSync` care eșuează (antivirusul încă
      // scanează folderul proaspăt copiat) ar sări peste restaurare și ar lăsa
      // utilizatorul fără niciun folder de atașamente.
      if (!existsSync(paths.attachmentsDir) && existsSync(vechi)) {
        renameSync(vechi, paths.attachmentsDir)
      }
      sterge(nou)
      throw new Error(
        `Baza de date a fost restaurată, dar atașamentele nu. (${(err as Error).message})`,
        { cause: err }
      )
    }
    // Ștergerea folderului vechi vine DUPĂ punctul fără întoarcere: restaurarea
    // a reușit deja. Dacă un fișier e ținut deschis în alt program, nu avem voie
    // să transformăm asta în „Restaurare eșuată” — rămâne doar un folder în plus.
    sterge(vechi)
  }
}

// Ștergere care nu are voie să dea peste cap operațiunea din care face parte.
function sterge(cale: string): void {
  try {
    rmSync(cale, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  } catch {
    // Un fișier blocat de antivirus sau deschis în alt program nu e motiv să
    // oprim o restaurare care altfel a reușit.
  }
}

// Repară o restaurare întreruptă exact între cele două redenumiri ale
// atașamentelor — fereastra în care folderul nu există sub niciun nume final.
// Rulează la pornire, înainte ca atașamentele să fie folosite.
export function reparaAtasamenteIntrerupte(attachmentsDir: string): void {
  if (existsSync(attachmentsDir)) return
  for (const candidat of [`${attachmentsDir}.nou`, `${attachmentsDir}.vechi`]) {
    if (existsSync(candidat)) {
      renameSync(candidat, attachmentsDir)
      return
    }
  }
}
