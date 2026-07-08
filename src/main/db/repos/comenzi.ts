import type { Database } from 'better-sqlite3'
import { getDb } from '../connection'
import { ajusteazaStoc } from './stoc'
import { calcComanda } from '@shared/calc'
import type {
  ComandaCuExtra,
  ComandaDetaliu,
  ComandaInput,
  LinieComanda,
  LinieComandaInput,
  StareComanda
} from '@shared/types'

const LIST_SQL = `
  SELECT c.*, cl.nume AS client_nume,
    (c.total - c.achitat) AS rest_de_plata,
    COALESCE((
      SELECT SUM((l.pret_unitar - l.cost_unitar) * l.cantitate)
      FROM linii_comanda l WHERE l.comanda_id = c.id
    ), 0) AS profit
  FROM comenzi c
  LEFT JOIN clienti cl ON cl.id = c.client_id
`

type RandComanda = ComandaCuExtra & { profit: number }

function mapRand(r: RandComanda): ComandaCuExtra {
  return { ...r, profit: Math.round(r.profit), rest_de_plata: Math.round(r.rest_de_plata) }
}

export function listComenzi(stare?: StareComanda): ComandaCuExtra[] {
  const db = getDb()
  const stmt = db.prepare(
    `${LIST_SQL}${stare ? ' WHERE c.stare = @stare' : ''} ORDER BY c.data_creare DESC, c.id DESC`
  )
  const rows = (stare ? stmt.all({ stare }) : stmt.all()) as RandComanda[]
  return rows.map(mapRand)
}

export function getComanda(id: number): ComandaDetaliu | undefined {
  const db = getDb()
  const c = db.prepare(`${LIST_SQL} WHERE c.id = @id`).get({ id }) as RandComanda | undefined
  if (!c) return undefined
  const linii = db
    .prepare('SELECT * FROM linii_comanda WHERE comanda_id = ? ORDER BY pozitie, id')
    .all(id) as LinieComanda[]
  return { ...mapRand(c), linii }
}

function insertLinii(db: Database, comandaId: number, linii: LinieComandaInput[]): void {
  const stmt = db.prepare(
    `INSERT INTO linii_comanda
      (comanda_id, produs_id, descriere, cantitate, unitate_masura, cost_unitar, pret_unitar, cota_tva, pozitie)
     VALUES
      (@comanda_id, @produs_id, @descriere, @cantitate, @unitate_masura, @cost_unitar, @pret_unitar, @cota_tva, @pozitie)`
  )
  linii.forEach((l, i) => {
    stmt.run({
      comanda_id: comandaId,
      produs_id: l.produs_id ?? null,
      descriere: l.descriere,
      cantitate: l.cantitate,
      unitate_masura: l.unitate_masura || 'buc',
      cost_unitar: l.cost_unitar,
      pret_unitar: l.pret_unitar,
      cota_tva: l.cota_tva,
      pozitie: l.pozitie ?? i
    })
  })
}

const toCalc = (linii: LinieComandaInput[]): Parameters<typeof calcComanda>[0] =>
  linii.map((l) => ({
    cantitate: l.cantitate,
    cost_unitar: l.cost_unitar,
    pret_unitar: l.pret_unitar,
    cota_tva: l.cota_tva
  }))

export function createComanda(input: ComandaInput): ComandaDetaliu {
  const db = getDb()
  const t = calcComanda(toCalc(input.linii))
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO comenzi (numar, client_id, stare, total_fara_tva, total_tva, total, observatii)
         VALUES (@numar, @client_id, 'oferta', @tf, @tt, @t, @obs)`
      )
      .run({
        numar: input.numar,
        client_id: input.client_id,
        tf: t.total_fara_tva,
        tt: t.total_tva,
        t: t.total,
        obs: input.observatii
      })
    const id = Number(info.lastInsertRowid)
    insertLinii(db, id, input.linii)
    if (!input.numar) {
      db.prepare('UPDATE comenzi SET numar = ? WHERE id = ?').run(
        'C' + String(id).padStart(4, '0'),
        id
      )
    }
    return id
  })
  return getComanda(tx())!
}

export function updateComanda(id: number, input: ComandaInput): ComandaDetaliu {
  const db = getDb()
  const t = calcComanda(toCalc(input.linii))
  const tx = db.transaction(() => {
    const cur = db.prepare('SELECT stare FROM comenzi WHERE id=?').get(id) as
      | { stare: StareComanda }
      | undefined
    if (!cur) throw new Error('Comanda nu există.')
    // O comandă confirmată a scăzut deja stocul. Anulăm efectul liniilor vechi
    // și aplicăm efectul celor noi, ca stocul să reflecte mereu liniile curente.
    if (cur.stare === 'comanda') aplicaStocComanda(db, id, 1)
    db.prepare(
      `UPDATE comenzi SET numar=@numar, client_id=@client_id, observatii=@obs,
        total_fara_tva=@tf, total_tva=@tt, total=@t, actualizat_la=datetime('now')
       WHERE id=@id`
    ).run({
      id,
      numar: input.numar,
      client_id: input.client_id,
      obs: input.observatii,
      tf: t.total_fara_tva,
      tt: t.total_tva,
      t: t.total
    })
    db.prepare('DELETE FROM linii_comanda WHERE comanda_id = ?').run(id)
    insertLinii(db, id, input.linii)
    if (cur.stare === 'comanda') aplicaStocComanda(db, id, -1)
  })
  tx()
  return getComanda(id)!
}

// Aplică efectul vânzării asupra stocului (semn -1 la confirmare, +1 la anulare).
function aplicaStocComanda(db: Database, comandaId: number, semn: number): void {
  const linii = db
    .prepare('SELECT produs_id, cantitate FROM linii_comanda WHERE comanda_id = ?')
    .all(comandaId) as { produs_id: number | null; cantitate: number }[]
  for (const l of linii) ajusteazaStoc(db, l.produs_id, semn * l.cantitate)
}

export function acceptaComanda(id: number): ComandaDetaliu {
  const db = getDb()
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `UPDATE comenzi SET stare='comanda', data_acceptare=datetime('now'),
          actualizat_la=datetime('now')
         WHERE id=? AND stare='oferta'`
      )
      .run(id)
    if (info.changes > 0) aplicaStocComanda(db, id, -1) // vânzarea scade stocul
  })
  tx()
  return getComanda(id)!
}

export function anuleazaComanda(id: number): ComandaDetaliu {
  const db = getDb()
  const tx = db.transaction(() => {
    const c = db.prepare('SELECT stare FROM comenzi WHERE id=?').get(id) as
      | { stare: StareComanda }
      | undefined
    if (!c) throw new Error('Comanda nu există.')
    if (c.stare === 'anulata') return // deja anulată — nu suprascriem data anulării
    db.prepare(
      `UPDATE comenzi SET stare='anulata', data_anulare=datetime('now'),
        actualizat_la=datetime('now')
       WHERE id=?`
    ).run(id)
    if (c.stare === 'comanda') aplicaStocComanda(db, id, 1) // restituie stocul
  })
  tx()
  return getComanda(id)!
}

// Adaugă o plată. Prima plată pe o ofertă o transformă automat în comandă.
export function inregistreazaPlata(id: number, suma: number): ComandaDetaliu {
  const db = getDb()
  const c = db.prepare('SELECT stare, achitat FROM comenzi WHERE id=?').get(id) as
    | { stare: StareComanda; achitat: number }
    | undefined
  if (!c) throw new Error('Comanda nu există.')
  if (c.stare === 'anulata') {
    throw new Error('Nu se pot înregistra plăți pe o comandă anulată.')
  }
  const nouAchitat = Math.max(0, c.achitat + Math.round(suma))
  const devineComanda = c.stare === 'oferta' && nouAchitat > 0
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE comenzi SET achitat=@achitat,
         stare = CASE WHEN @devine = 1 THEN 'comanda' ELSE stare END,
         data_acceptare = CASE WHEN @devine = 1 AND data_acceptare IS NULL THEN datetime('now') ELSE data_acceptare END,
         actualizat_la = datetime('now')
       WHERE id=@id`
    ).run({ id, achitat: nouAchitat, devine: devineComanda ? 1 : 0 })
    if (devineComanda) aplicaStocComanda(db, id, -1) // vânzarea scade stocul
  })
  tx()
  return getComanda(id)!
}

// Ștergerea e permisă doar pentru oferte (schițe). O comandă confirmată a
// mișcat stocul și face parte din istoric — ea se anulează, nu se șterge.
export function deleteComanda(id: number): void {
  const db = getDb()
  const c = db.prepare('SELECT stare FROM comenzi WHERE id=?').get(id) as
    | { stare: StareComanda }
    | undefined
  if (!c) return
  if (c.stare !== 'oferta') {
    throw new Error('Doar ofertele pot fi șterse. Comenzile se anulează și rămân în istoric.')
  }
  db.prepare('DELETE FROM comenzi WHERE id = ?').run(id)
}
