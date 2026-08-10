import { describe, expect, it } from 'vitest'
import { decalaj } from '../src/renderer/src/lib/animatie'

const val = (i: number, max?: number): number => (decalaj(i, max) as Record<string, number>)['--i']

describe('decalajul animațiilor', () => {
  it('crește pentru primele elemente', () => {
    expect(val(0)).toBe(0)
    expect(val(3)).toBe(3)
  })

  it('se plafonează, ca o listă lungă să nu apară în valuri la nesfârșit', () => {
    // 2000 de rânduri × 22 ms ar însemna 44 de secunde până la ultimul.
    expect(val(2000)).toBe(10)
    expect(val(11)).toBe(10)
    // întârzierea maximă reală rămâne sub un sfert de secundă
    expect(val(2000) * 22).toBeLessThan(250)
  })

  it('plafonul poate fi coborât unde e nevoie', () => {
    expect(val(50, 3)).toBe(3)
  })
})
