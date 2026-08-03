import { dialog, shell, type BrowserWindow } from 'electron'
import { join, basename, extname } from 'path'
import { existsSync, mkdirSync, copyFileSync, statSync, rmSync } from 'fs'
import { randomUUID } from 'crypto'
import { getDb } from './db/connection'
import { attachmentsDir } from './backup'
import { jurnal } from './log'
import type { EntitateTip, Fisier } from '@shared/types'

const TIPURI: readonly EntitateTip[] = ['produs', 'client', 'furnizor', 'comanda', 'achizitie']

// `tip` vine din interfață și ajunge într-o cale de fișier, iar tipurile
// TypeScript dispar la execuție. Fără verificarea asta, un „..\\..\\Documents”
// ar scoate scrierile și ștergerile în afara folderului de atașamente.
function verificaTip(tip: EntitateTip): EntitateTip {
  if (!TIPURI.includes(tip)) throw new Error('Tip de înregistrare necunoscut.')
  return tip
}

// `id` ajunge în cale la fel ca `tip`, deci merită aceeași neîncredere.
function verificaId(id: number): number {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Înregistrare invalidă.')
  return id
}

// Pe Windows un fișier deschis în alt program (Acrobat, Excel) nu poate fi
// șters: primim EPERM/EBUSY. Reîncercăm scurt, apoi spunem omenește ce e de făcut.
function stergeFisier(cale: string): void {
  try {
    rmSync(cale, { force: true, maxRetries: 5, retryDelay: 200 })
  } catch (err) {
    const cod = (err as NodeJS.ErrnoException).code
    if (cod === 'EPERM' || cod === 'EBUSY') {
      throw new Error(
        `Fișierul „${basename(cale)}” este deschis în alt program. Închide-l și încearcă din nou.`,
        { cause: err }
      )
    }
    throw err
  }
}

function stergeFolder(cale: string): void {
  rmSync(cale, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}

export function listFisiere(tip: EntitateTip, id: number): Fisier[] {
  return getDb()
    .prepare(
      'SELECT * FROM fisiere WHERE entitate_tip = ? AND entitate_id = ? ORDER BY creat_la DESC'
    )
    .all(verificaTip(tip), verificaId(id)) as Fisier[]
}

export async function attachFisiere(
  win: BrowserWindow | undefined,
  tip: EntitateTip,
  id: number
): Promise<Fisier[]> {
  verificaTip(tip)
  verificaId(id)
  const res = await dialog.showOpenDialog(win!, {
    title: 'Alege fișiere de atașat',
    properties: ['openFile', 'multiSelections']
  })
  if (res.canceled || res.filePaths.length === 0) return listFisiere(tip, id)

  const folder = join(attachmentsDir(), tip, String(id))
  mkdirSync(folder, { recursive: true })

  // Copiem ÎNAINTE de tranzacție. Copierea poate dura (share de rețea, fișier
  // OneDrive nesincronizat), iar o tranzacție SQLite ține blocajul de scriere
  // tot acest timp. Mai important: dacă al patrulea fișier eșuează, tranzacția
  // ar anula toate rândurile, dar fișierele deja copiate ar rămâne pe disc
  // pentru totdeauna — invizibile în interfață și incluse în fiecare backup.
  const copiate: { nume: string; rel: string; ext: string | null; marime: number }[] = []
  try {
    for (const src of res.filePaths) {
      const nume = basename(src)
      const ext = extname(nume).slice(1).toLowerCase() || null
      // Numele de pe disc este scurt și previzibil (uuid + extensie): numele
      // original al utilizatorului poate avea 150 de caractere, iar împreună cu
      // calea din %APPDATA% ar trece de limita de 260 de caractere a Windows.
      // Numele adevărat rămâne în coloana `nume`, care e cel afișat oricum.
      const rel = join(tip, String(id), `${randomUUID()}${ext ? `.${ext}` : ''}`)
      const dest = join(attachmentsDir(), rel)
      copyFileSync(src, dest)
      copiate.push({ nume, rel, ext, marime: statSync(dest).size })
    }
  } catch (err) {
    for (const c of copiate) rmSync(join(attachmentsDir(), c.rel), { force: true })
    throw new Error(`Fișierele nu au putut fi copiate: ${(err as Error).message}`, { cause: err })
  }

  const db = getDb()
  const stmt = db.prepare(
    'INSERT INTO fisiere (nume, cale, tip, marime, entitate_tip, entitate_id) VALUES (?, ?, ?, ?, ?, ?)'
  )
  try {
    db.transaction(() => {
      for (const c of copiate) stmt.run(c.nume, c.rel, c.ext, c.marime, tip, id)
    })()
  } catch (err) {
    for (const c of copiate) rmSync(join(attachmentsDir(), c.rel), { force: true })
    throw err
  }

  return listFisiere(tip, id)
}

export async function openFisier(id: number): Promise<void> {
  const f = getDb().prepare('SELECT nume, cale FROM fisiere WHERE id = ?').get(id) as
    { nume: string; cale: string } | undefined
  if (!f) throw new Error('Fișierul nu mai există în evidență.')

  const cale = join(attachmentsDir(), f.cale)
  if (!existsSync(cale)) {
    throw new Error(`Fișierul „${f.nume}” nu mai există pe disc.`)
  }
  // shell.openPath NU respinge promisiunea la eroare: întoarce un text.
  // Ignorat, un dublu-clic care nu face nimic pare o aplicație stricată.
  const eroare = await shell.openPath(cale)
  if (eroare) throw new Error(`Fișierul „${f.nume}” nu a putut fi deschis: ${eroare}`)
}

// La ștergerea unei înregistrări, atașamentele ei nu trebuie să rămână
// orfane pe disc (ar crește fiecare backup, pentru totdeauna).
export function stergeAtasamenteEntitate(tip: EntitateTip, id: number): void {
  verificaTip(tip)
  verificaId(id)
  getDb().prepare('DELETE FROM fisiere WHERE entitate_tip = ? AND entitate_id = ?').run(tip, id)

  // Curățarea discului este best-effort și NU trebuie să arunce: înregistrarea
  // a fost deja ștearsă, iar dacă am propaga eroarea (un PDF ținut deschis în
  // Acrobat dă EPERM pe Windows), interfața ar arăta „ștergerea a eșuat” și ar
  // continua să afișeze un client care nu mai există. Ce rămâne în urmă este
  // cel mult un folder de fișiere orfane, nu o listă mincinoasă.
  try {
    stergeFolder(join(attachmentsDir(), tip, String(id)))
  } catch (err) {
    jurnal.warn(`Atașamentele lui ${tip} #${id} nu au putut fi șterse de pe disc:`, err)
  }
}

export function deleteFisier(id: number): void {
  const db = getDb()
  const f = db.prepare('SELECT cale FROM fisiere WHERE id = ?').get(id) as
    { cale: string } | undefined
  if (f) stergeFisier(join(attachmentsDir(), f.cale))
  db.prepare('DELETE FROM fisiere WHERE id = ?').run(id)
}
