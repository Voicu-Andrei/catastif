import type { StareComanda } from '@shared/types'

export const STARE_META: Record<StareComanda, { label: string; color: string }> = {
  oferta: { label: 'Ofertă', color: 'indigo' },
  comanda: { label: 'Comandă', color: 'teal' },
  anulata: { label: 'Anulată', color: 'gray' }
}
