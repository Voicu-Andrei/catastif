// Unitățile de măsură folosite în toată aplicația (produse, linii de comandă,
// linii de achiziție). O singură listă, ca lista de produse, comanda, achiziția
// și PDF-ul să vorbească aceeași limbă.
//
// Se stochează valoarea scurtă („buc”), se afișează eticheta („Buc”).

export const UNITATI_MASURA = [
  { value: 'buc', label: 'Buc', descriere: 'Bucată' },
  { value: 'mp', label: 'Mp', descriere: 'Metru pătrat' },
  { value: 'ml', label: 'Ml', descriere: 'Metru liniar' }
] as const

export type UnitateMasura = (typeof UNITATI_MASURA)[number]['value']

export const UM_IMPLICITA: UnitateMasura = 'buc'

export const UM_SELECT_DATA = UNITATI_MASURA.map((u) => ({ value: u.value, label: u.label }))

// Normalizează orice text vechi sau introdus liber la una dintre unitățile
// cunoscute. Datele de dinaintea listei fixe conțin „bucata”, „BUC”, „m2”, „m.l.”
// — toate trebuie să ajungă pe aceeași valoare, altfel dropdownul apare gol.
export function normalizeazaUm(valoare: string | null | undefined): UnitateMasura {
  const v = String(valoare ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s.]/g, '')
  if (v === 'mp' || v === 'm2' || v === 'metrupatrat') return 'mp'
  if (v === 'ml' || v === 'm' || v === 'metruliniar') return 'ml'
  return UM_IMPLICITA
}

export function etichetaUm(valoare: string | null | undefined): string {
  const v = normalizeazaUm(valoare)
  return UNITATI_MASURA.find((u) => u.value === v)!.label
}
