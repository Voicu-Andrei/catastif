import { getDb } from '../connection'
import type { ActivitateItem, DashboardData } from '@shared/types'

const scalar = (sql: string): number => {
  const r = getDb().prepare(sql).get() as { v: number }
  return r.v
}

interface RandComandaRec {
  id: number
  numar: string | null
  stare: string
  total: number
  creat_la: string
  client_nume: string | null
}
interface RandAchizitieRec {
  id: number
  total: number
  creat_la: string
  furnizor_nume: string | null
}

export function getDashboard(): DashboardData {
  const db = getDb()

  const oferte = scalar("SELECT COUNT(*) v FROM comenzi WHERE stare='oferta'")
  const active = scalar("SELECT COUNT(*) v FROM comenzi WHERE stare='comanda'")
  const deIncasat = scalar("SELECT COALESCE(SUM(total-achitat),0) v FROM comenzi WHERE stare='comanda'")
  const profitLuna = scalar(`
    SELECT COALESCE(SUM((l.pret_unitar - l.cost_unitar) * l.cantitate), 0) v
    FROM linii_comanda l JOIN comenzi c ON c.id = l.comanda_id
    WHERE c.stare='comanda'
      AND strftime('%Y-%m', COALESCE(c.data_acceptare, c.data_creare)) = strftime('%Y-%m','now')
  `)
  const stocScazut = scalar(
    'SELECT COUNT(*) v FROM produse WHERE track_stock=1 AND prag_stoc IS NOT NULL AND stoc_curent <= prag_stoc'
  )

  const comenzi = db
    .prepare(
      `SELECT c.id, c.numar, c.stare, c.total, c.creat_la, cl.nume AS client_nume
       FROM comenzi c LEFT JOIN clienti cl ON cl.id = c.client_id
       ORDER BY c.creat_la DESC LIMIT 6`
    )
    .all() as RandComandaRec[]
  const achizitii = db
    .prepare(
      `SELECT a.id, a.total, a.creat_la, f.nume AS furnizor_nume
       FROM achizitii a LEFT JOIN furnizori f ON f.id = a.furnizor_id
       ORDER BY a.creat_la DESC LIMIT 6`
    )
    .all() as RandAchizitieRec[]

  const activitate: ActivitateItem[] = [
    ...comenzi.map<ActivitateItem>((c) => ({
      tip: c.stare,
      titlu: `${c.stare === 'oferta' ? 'Ofertă' : c.stare === 'anulata' ? 'Comandă anulată' : 'Comandă'} ${
        c.numar ?? '#' + c.id
      }${c.client_nume ? ' — ' + c.client_nume : ''}`,
      data: c.creat_la,
      suma: c.total,
      link: `/comenzi/${c.id}`
    })),
    ...achizitii.map<ActivitateItem>((a) => ({
      tip: 'achizitie',
      titlu: `Achiziție${a.furnizor_nume ? ' — ' + a.furnizor_nume : ''}`,
      data: a.creat_la,
      suma: a.total,
      link: `/achizitii/${a.id}`
    }))
  ]
    .sort((x, y) => (x.data < y.data ? 1 : -1))
    .slice(0, 8)

  return {
    oferte_in_asteptare: oferte,
    comenzi_active: active,
    de_incasat: deIncasat,
    profit_luna: Math.round(profitLuna),
    stoc_scazut: stocScazut,
    activitate
  }
}
