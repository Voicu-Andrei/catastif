// Validare la granița de încredere (procesul main). Interfața validează deja
// pentru confort, dar baza de date e registrul real al afacerii — nimic
// nevalidat nu trece de aici. Mesajele sunt în română: ajung direct în UI.

import type {
  AchizitieInput,
  ClientInput,
  ComandaInput,
  FurnizorInput,
  LinieAchizitieInput,
  LinieComandaInput,
  ProdusInput
} from '@shared/types'

const esteNumar = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function cereNume(nume: unknown, mesaj: string): void {
  if (typeof nume !== 'string' || nume.trim() === '') throw new Error(mesaj)
}

function cereCotaTva(cota: unknown, context: string): void {
  if (!esteNumar(cota) || cota < 0 || cota > 100) {
    throw new Error(`${context}: cota TVA trebuie să fie un procent între 0 și 100.`)
  }
}

function cereBaniPozitivi(v: unknown, context: string): void {
  if (!esteNumar(v) || v < 0) {
    throw new Error(`${context}: valoarea nu poate fi negativă.`)
  }
}

function cereCantitate(v: unknown, context: string): void {
  if (!esteNumar(v) || v <= 0) {
    throw new Error(`${context}: cantitatea trebuie să fie un număr mai mare decât zero.`)
  }
}

// O linie e identificabilă fie prin descriere, fie prin produsul ales.
function cereLinieIdentificabila(
  l: { descriere: string; produs_id: number | null },
  context: string
): void {
  if ((!l.descriere || l.descriere.trim() === '') && l.produs_id == null) {
    throw new Error(`${context}: alege un produs sau scrie o descriere.`)
  }
}

function valideazaLinieComanda(l: LinieComandaInput, idx: number): void {
  const ctx = `Linia ${idx + 1}`
  cereLinieIdentificabila(l, ctx)
  cereCantitate(l.cantitate, ctx)
  cereBaniPozitivi(l.cost_unitar, `${ctx} (cost)`)
  cereBaniPozitivi(l.pret_unitar, `${ctx} (preț)`)
  cereCotaTva(l.cota_tva, ctx)
}

export function valideazaComanda(input: ComandaInput): void {
  if (!Array.isArray(input.linii) || input.linii.length === 0) {
    throw new Error('Comanda trebuie să aibă cel puțin o linie.')
  }
  input.linii.forEach(valideazaLinieComanda)
}

function valideazaLinieAchizitie(l: LinieAchizitieInput, idx: number): void {
  const ctx = `Linia ${idx + 1}`
  cereLinieIdentificabila(l, ctx)
  cereCantitate(l.cantitate, ctx)
  cereBaniPozitivi(l.cost_unitar, `${ctx} (cost)`)
}

export function valideazaAchizitie(input: AchizitieInput): void {
  if (typeof input.data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.data)) {
    throw new Error('Data achiziției nu este validă (format așteptat: AAAA-LL-ZZ).')
  }
  if (!Array.isArray(input.linii) || input.linii.length === 0) {
    throw new Error('Achiziția trebuie să aibă cel puțin o linie.')
  }
  input.linii.forEach(valideazaLinieAchizitie)
}

export function valideazaProdus(input: ProdusInput): void {
  cereNume(input.nume, 'Numele produsului este obligatoriu.')
  cereCotaTva(input.cota_tva, 'Produs')
  if (input.cost_referinta != null) cereBaniPozitivi(input.cost_referinta, 'Cost de achiziție')
  if (input.pret_referinta != null) cereBaniPozitivi(input.pret_referinta, 'Preț de vânzare')
  if (!esteNumar(input.stoc_curent ?? 0) || (input.stoc_curent ?? 0) < 0) {
    throw new Error('Stocul curent nu poate fi negativ.')
  }
  if (input.prag_stoc != null && (!esteNumar(input.prag_stoc) || input.prag_stoc < 0)) {
    throw new Error('Pragul de stoc nu poate fi negativ.')
  }
}

export function valideazaClient(input: ClientInput): void {
  cereNume(input.nume, 'Numele clientului este obligatoriu.')
  if (input.tip !== 'firma' && input.tip !== 'persoana') {
    throw new Error('Tipul clientului trebuie să fie „firmă” sau „persoană”.')
  }
}

export function valideazaFurnizor(input: FurnizorInput): void {
  cereNume(input.nume, 'Numele furnizorului este obligatoriu.')
}

export function valideazaSumaPlata(suma: unknown): void {
  if (!esteNumar(suma)) throw new Error('Suma plății nu este un număr valid.')
}
