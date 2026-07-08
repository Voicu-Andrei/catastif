// Formatare în convenții românești (ro-RO).

const numFmt = new Intl.NumberFormat('ro-RO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

// Primește BANI, întoarce ex. „1.234,56 lei” (aceeași etichetă ca în PDF-uri).
export const formatLei = (bani: number): string => `${numFmt.format(bani / 100)} lei`

export const formatNumar = (n: number): string => numFmt.format(n)

export const formatData = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const d = new Date(iso.includes('T') || iso.includes(' ') ? iso : `${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ro-RO')
}

export const formatMarime = (bytes: number | null | undefined): string => {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
