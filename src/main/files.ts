import { dialog, shell, type BrowserWindow } from 'electron'
import { join, basename, extname } from 'path'
import { existsSync, mkdirSync, copyFileSync, statSync, rmSync } from 'fs'
import { randomUUID } from 'crypto'
import { getDb } from './db/connection'
import { attachmentsDir } from './backup'
import type { EntitateTip, Fisier } from '@shared/types'

export function listFisiere(tip: EntitateTip, id: number): Fisier[] {
  return getDb()
    .prepare(
      'SELECT * FROM fisiere WHERE entitate_tip = ? AND entitate_id = ? ORDER BY creat_la DESC'
    )
    .all(tip, id) as Fisier[]
}

export async function attachFisiere(
  win: BrowserWindow | undefined,
  tip: EntitateTip,
  id: number
): Promise<Fisier[]> {
  const res = await dialog.showOpenDialog(win!, {
    title: 'Alege fișiere de atașat',
    properties: ['openFile', 'multiSelections']
  })
  if (res.canceled || res.filePaths.length === 0) return listFisiere(tip, id)

  const db = getDb()
  const stmt = db.prepare(
    'INSERT INTO fisiere (nume, cale, tip, marime, entitate_tip, entitate_id) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const tx = db.transaction(() => {
    for (const src of res.filePaths) {
      const nume = basename(src)
      const rel = join(tip, String(id), `${randomUUID()}-${nume}`)
      const dest = join(attachmentsDir(), rel)
      mkdirSync(join(attachmentsDir(), tip, String(id)), { recursive: true })
      copyFileSync(src, dest)
      const marime = statSync(dest).size
      stmt.run(nume, rel, extname(nume).slice(1).toLowerCase() || null, marime, tip, id)
    }
  })
  tx()
  return listFisiere(tip, id)
}

export function openFisier(id: number): void {
  const f = getDb().prepare('SELECT cale FROM fisiere WHERE id = ?').get(id) as
    { cale: string } | undefined
  if (f) shell.openPath(join(attachmentsDir(), f.cale))
}

export function deleteFisier(id: number): void {
  const db = getDb()
  const f = db.prepare('SELECT cale FROM fisiere WHERE id = ?').get(id) as
    { cale: string } | undefined
  if (f) {
    const p = join(attachmentsDir(), f.cale)
    if (existsSync(p)) rmSync(p, { force: true })
  }
  db.prepare('DELETE FROM fisiere WHERE id = ?').run(id)
}
