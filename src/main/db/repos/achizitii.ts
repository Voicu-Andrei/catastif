import type { Database } from 'better-sqlite3'
import { getDb } from '../connection'
import { ajusteazaStoc } from './stoc'
import { valideazaAchizitie } from '../validate'
import type {
  AchizitieCuExtra,
  AchizitieDetaliu,
  AchizitieInput,
  LinieAchizitie,
  LinieAchizitieInput
} from '@shared/types'

const LIST_SQL = `
  SELECT a.*, f.nume AS furnizor_nume,
    (SELECT COUNT(*) FROM linii_achizitie l WHERE l.achizitie_id = a.id) AS nr_linii
  FROM achizitii a
  LEFT JOIN furnizori f ON f.id = a.furnizor_id
`

const totalLinii = (linii: LinieAchizitieInput[]): number =>
  linii.reduce((s, l) => s + Math.round(l.cantitate * l.cost_unitar), 0)

export function listAchizitii(): AchizitieCuExtra[] {
  return getDb().prepare(`${LIST_SQL} ORDER BY a.data DESC, a.id DESC`).all() as AchizitieCuExtra[]
}

function achizitieSauEroare(id: number): AchizitieDetaliu {
  const a = getAchizitie(id)
  if (!a) throw new Error('Achiziția nu mai există.')
  return a
}

export function getAchizitie(id: number): AchizitieDetaliu | undefined {
  const db = getDb()
  const a = db.prepare(`${LIST_SQL} WHERE a.id = @id`).get({ id }) as AchizitieCuExtra | undefined
  if (!a) return undefined
  const linii = db
    .prepare('SELECT * FROM linii_achizitie WHERE achizitie_id = ? ORDER BY id')
    .all(id) as LinieAchizitie[]
  return { ...a, linii }
}

function insertLinii(
  db: Database,
  achizitieId: number,
  data: string,
  linii: LinieAchizitieInput[]
): void {
  const stmt = db.prepare(
    `INSERT INTO linii_achizitie
      (achizitie_id, produs_id, descriere, cantitate, unitate_masura, cost_unitar, data)
     VALUES (@achizitie_id, @produs_id, @descriere, @cantitate, @unitate_masura, @cost_unitar, @data)`
  )
  for (const l of linii) {
    stmt.run({
      achizitie_id: achizitieId,
      produs_id: l.produs_id ?? null,
      descriere: l.descriere,
      cantitate: l.cantitate,
      unitate_masura: l.unitate_masura || 'buc',
      cost_unitar: l.cost_unitar,
      data: l.data || data
    })
    // Achiziția crește stocul produselor urmărite.
    ajusteazaStoc(db, l.produs_id ?? null, l.cantitate)
  }
}

// Anulează efectul asupra stocului al liniilor existente (înainte de ștergere/actualizare).
function reverseStoc(db: Database, achizitieId: number): void {
  const linii = db
    .prepare('SELECT produs_id, cantitate FROM linii_achizitie WHERE achizitie_id = ?')
    .all(achizitieId) as { produs_id: number | null; cantitate: number }[]
  for (const l of linii) ajusteazaStoc(db, l.produs_id, -l.cantitate)
}

export function createAchizitie(input: AchizitieInput): AchizitieDetaliu {
  valideazaAchizitie(input)
  const db = getDb()
  const total = totalLinii(input.linii)
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO achizitii (furnizor_id, data, numar_document, total, observatii)
         VALUES (@furnizor_id, @data, @numar_document, @total, @observatii)`
      )
      .run({
        furnizor_id: input.furnizor_id,
        data: input.data,
        numar_document: input.numar_document,
        total,
        observatii: input.observatii
      })
    const id = Number(info.lastInsertRowid)
    insertLinii(db, id, input.data, input.linii)
    return id
  })
  return getAchizitie(tx())!
}

export function updateAchizitie(id: number, input: AchizitieInput): AchizitieDetaliu {
  valideazaAchizitie(input)
  const db = getDb()
  const total = totalLinii(input.linii)
  const tx = db.transaction(() => {
    reverseStoc(db, id)
    db.prepare('DELETE FROM linii_achizitie WHERE achizitie_id = ?').run(id)
    db.prepare(
      `UPDATE achizitii SET furnizor_id=@furnizor_id, data=@data, numar_document=@numar_document,
        total=@total, observatii=@observatii WHERE id=@id`
    ).run({
      id,
      furnizor_id: input.furnizor_id,
      data: input.data,
      numar_document: input.numar_document,
      total,
      observatii: input.observatii
    })
    insertLinii(db, id, input.data, input.linii)
  })
  tx()
  return achizitieSauEroare(id)
}

export function deleteAchizitie(id: number): void {
  const db = getDb()
  const tx = db.transaction(() => {
    reverseStoc(db, id)
    db.prepare('DELETE FROM achizitii WHERE id = ?').run(id)
  })
  tx()
}
