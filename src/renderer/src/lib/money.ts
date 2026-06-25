// Conversii bani <-> lei. Intern stocăm BANI (întreg).

export const baniToLei = (bani: number): number => bani / 100

export const leiToBani = (lei: number): number => Math.round(lei * 100)
