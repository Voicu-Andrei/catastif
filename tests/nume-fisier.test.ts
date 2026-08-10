import { describe, it, expect } from 'vitest'
import { numeFisierSigur } from '../src/main/nume-fisier'

describe('nume de fișier sigure pe Windows', () => {
  it('înlocuiește bara din numerele de comandă românești („F 145/2026”)', () => {
    // Fără asta, Windows citește bara ca separator de folder și fereastra de
    // salvare se deschide în alt loc, cu numele „2026.pdf”.
    expect(numeFisierSigur('Comanda-F 145/2026')).toBe('Comanda-F 145-2026')
  })

  it('înlocuiește toate caracterele refuzate de NTFS', () => {
    expect(numeFisierSigur('a<b>c:d"e/f\\g|h?i*j')).toBe('a-b-c-d-e-f-g-h-i-j')
  })

  it('păstrează spațiile și cratimele, care sunt legale', () => {
    expect(numeFisierSigur('Raport anual - 2026')).toBe('Raport anual - 2026')
  })

  it('elimină caracterele de control', () => {
    expect(numeFisierSigur('fisiernou')).toBe('fisier-nou')
  })

  it('refuză numele de dispozitiv MS-DOS, care nu pot fi create nici cu extensie', () => {
    expect(numeFisierSigur('CON')).toBe('document')
    expect(numeFisierSigur('lpt1')).toBe('document')
    expect(numeFisierSigur('nul', 'Comanda')).toBe('Comanda')
  })

  it('taie punctele și spațiile de la final, pe care Windows le înlătură tăcut', () => {
    expect(numeFisierSigur('Oferta ...')).toBe('Oferta')
    expect(numeFisierSigur('   ')).toBe('document')
  })

  it('scurtează numele foarte lungi, ca să nu depășim limita de cale', () => {
    const rezultat = numeFisierSigur('x'.repeat(200))
    expect(rezultat.length).toBe(80)
  })

  it('nu lasă niciodată un nume gol', () => {
    expect(numeFisierSigur('')).toBe('document')
    expect(numeFisierSigur('///')).toBe('---')
  })
})
