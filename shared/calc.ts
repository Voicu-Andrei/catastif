// Calcule pentru linii și comenzi. Toate valorile sunt în BANI (întreg).
// Folosit identic în main (totaluri persistate) și în renderer (previzualizare live)
// => o singură sursă de adevăr.

export interface LinieCalcInput {
  cantitate: number
  cost_unitar: number // bani
  pret_unitar: number // bani
  cota_tva: number // procent (ex. 21)
}

export interface LinieCalc {
  net: number // valoare fără TVA
  tva: number
  total: number // net + tva
  cost: number
  profit: number // net - cost (TVA e neutru)
}

export function calcLinie(l: LinieCalcInput): LinieCalc {
  const net = Math.round(l.cantitate * l.pret_unitar)
  const tva = Math.round((net * l.cota_tva) / 100)
  const cost = Math.round(l.cantitate * l.cost_unitar)
  return { net, tva, total: net + tva, cost, profit: net - cost }
}

export interface ComandaTotaluri {
  total_fara_tva: number
  total_tva: number
  total: number
  profit: number
}

export function calcComanda(linii: LinieCalcInput[]): ComandaTotaluri {
  let net = 0
  let tva = 0
  let cost = 0
  for (const l of linii) {
    const c = calcLinie(l)
    net += c.net
    tva += c.tva
    cost += c.cost
  }
  return { total_fara_tva: net, total_tva: tva, total: net + tva, profit: net - cost }
}
