import { getDb } from '../connection'
import type {
  RaportClient,
  RaportData,
  RaportFurnizor,
  RaportIncasare,
  RaportLunar
} from '@shared/types'

function aniDisponibili(): number[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT DISTINCT strftime('%Y', COALESCE(data_acceptare, data_creare)) AS an FROM comenzi
       UNION SELECT DISTINCT strftime('%Y', data) AS an FROM achizitii`
    )
    .all() as { an: string | null }[]
  const set = new Set<number>()
  for (const r of rows) if (r.an) set.add(Number(r.an))
  set.add(new Date().getFullYear())
  return [...set].sort((a, b) => b - a)
}

export function getRapoarte(an: number): RaportData {
  const db = getDb()
  const anStr = String(an)

  const vanzari = db
    .prepare(
      `SELECT strftime('%m', COALESCE(c.data_acceptare, c.data_creare)) AS luna,
        SUM(c.total_fara_tva) AS total_fara_tva
       FROM comenzi c
       WHERE c.stare='comanda' AND strftime('%Y', COALESCE(c.data_acceptare, c.data_creare)) = @an
       GROUP BY luna`
    )
    .all({ an: anStr }) as { luna: string; total_fara_tva: number }[]

  const profit = db
    .prepare(
      `SELECT strftime('%m', COALESCE(c.data_acceptare, c.data_creare)) AS luna,
        SUM((l.pret_unitar - l.cost_unitar) * l.cantitate) AS profit
       FROM comenzi c JOIN linii_comanda l ON l.comanda_id = c.id
       WHERE c.stare='comanda' AND strftime('%Y', COALESCE(c.data_acceptare, c.data_creare)) = @an
       GROUP BY luna`
    )
    .all({ an: anStr }) as { luna: string; profit: number }[]

  const vMap = new Map(vanzari.map((v) => [v.luna, v.total_fara_tva]))
  const pMap = new Map(profit.map((p) => [p.luna, p.profit]))
  const vanzari_lunare: RaportLunar[] = []
  for (let m = 1; m <= 12; m++) {
    const luna = String(m).padStart(2, '0')
    vanzari_lunare.push({
      luna,
      total_fara_tva: Math.round(vMap.get(luna) ?? 0),
      profit: Math.round(pMap.get(luna) ?? 0)
    })
  }

  const profit_pe_client = db
    .prepare(
      `SELECT COALESCE(cl.nume, '(fără client)') AS client,
        SUM(c.total_fara_tva) AS total,
        SUM((SELECT COALESCE(SUM((l.pret_unitar - l.cost_unitar) * l.cantitate), 0)
             FROM linii_comanda l WHERE l.comanda_id = c.id)) AS profit
       FROM comenzi c LEFT JOIN clienti cl ON cl.id = c.client_id
       WHERE c.stare='comanda' AND strftime('%Y', COALESCE(c.data_acceptare, c.data_creare)) = @an
       GROUP BY c.client_id ORDER BY profit DESC LIMIT 20`
    )
    .all({ an: anStr }) as RaportClient[]

  const achizitii_pe_furnizor = db
    .prepare(
      `SELECT COALESCE(f.nume, '(fără furnizor)') AS furnizor, SUM(a.total) AS total
       FROM achizitii a LEFT JOIN furnizori f ON f.id = a.furnizor_id
       WHERE strftime('%Y', a.data) = @an
       GROUP BY a.furnizor_id ORDER BY total DESC LIMIT 20`
    )
    .all({ an: anStr }) as RaportFurnizor[]

  const de_incasat = db
    .prepare(
      `SELECT c.id, c.numar, cl.nume AS client, c.total, c.achitat, (c.total - c.achitat) AS rest
       FROM comenzi c LEFT JOIN clienti cl ON cl.id = c.client_id
       WHERE c.stare='comanda' AND (c.total - c.achitat) > 0
       ORDER BY rest DESC`
    )
    .all() as RaportIncasare[]

  return {
    an,
    ani: aniDisponibili(),
    vanzari_lunare,
    profit_pe_client: profit_pe_client.map((r) => ({
      ...r,
      total: Math.round(r.total),
      profit: Math.round(r.profit)
    })),
    achizitii_pe_furnizor: achizitii_pe_furnizor.map((r) => ({ ...r, total: Math.round(r.total) })),
    de_incasat
  }
}
