import { describe, expect, it } from 'vitest'
import { calcLinie, calcComanda } from '../shared/calc'

describe('calcLinie', () => {
  it('calculează net, TVA, total și profit în bani întregi', () => {
    // 2 buc × 100,00 lei, cost 60,00 lei, TVA 21%
    const l = calcLinie({ cantitate: 2, pret_unitar: 10000, cost_unitar: 6000, cota_tva: 21 })
    expect(l.net).toBe(20000)
    expect(l.tva).toBe(4200)
    expect(l.total).toBe(24200)
    expect(l.cost).toBe(12000)
    expect(l.profit).toBe(8000)
  })

  it('rotunjește corect cantitățile zecimale', () => {
    // 1,5 m × 33,33 lei = 49,995 → 50,00 lei
    const l = calcLinie({ cantitate: 1.5, pret_unitar: 3333, cost_unitar: 0, cota_tva: 21 })
    expect(l.net).toBe(5000)
    expect(l.tva).toBe(1050)
  })

  it('TVA 0% lasă totalul egal cu netul', () => {
    const l = calcLinie({ cantitate: 1, pret_unitar: 9999, cost_unitar: 0, cota_tva: 0 })
    expect(l.tva).toBe(0)
    expect(l.total).toBe(l.net)
  })

  it('profitul poate fi negativ (vânzare sub cost)', () => {
    const l = calcLinie({ cantitate: 1, pret_unitar: 5000, cost_unitar: 8000, cota_tva: 21 })
    expect(l.profit).toBe(-3000)
  })
})

describe('calcComanda', () => {
  it('însumează liniile (TVA rotunjit pe linie)', () => {
    const t = calcComanda([
      { cantitate: 1, pret_unitar: 105, cost_unitar: 0, cota_tva: 21 }, // tva 22,05 → 22
      { cantitate: 1, pret_unitar: 105, cost_unitar: 0, cota_tva: 21 }
    ])
    expect(t.total_fara_tva).toBe(210)
    expect(t.total_tva).toBe(44) // 22 + 22, nu round(44,1)
    expect(t.total).toBe(254)
  })

  it('lista goală dă totaluri zero', () => {
    const t = calcComanda([])
    expect(t).toEqual({ total_fara_tva: 0, total_tva: 0, total: 0, profit: 0 })
  })
})
