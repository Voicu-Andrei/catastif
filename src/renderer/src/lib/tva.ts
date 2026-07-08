// Cotele TVA folosite în aplicație — un singur loc (editor comandă, produse, setări).

export const COTE_TVA = [21, 11, 9, 0] as const

export const TVA_SELECT_DATA = COTE_TVA.map((c) => ({
  value: String(c),
  label: c === 21 ? '21% (standard)' : c === 11 ? '11% (redusă)' : `${c}%`
}))
