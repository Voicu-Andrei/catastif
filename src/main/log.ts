// Jurnal de fișier pentru procesul principal.
//
// Într-o aplicație Windows împachetată nu există consolă: tot ce scrii cu
// console.error dispare. Fără un fișier de jurnal, o actualizare eșuată sau un
// backup automat care nu mai merge sunt complet invizibile — și pentru
// utilizator, și pentru cine încearcă să-l ajute.
//
// Jurnalul stă lângă date, în userData, și se rotește la 1 MB (păstrăm și
// fișierul precedent), ca să nu crească la nesfârșit.

import { app } from 'electron'
import { join } from 'path'
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, rmSync } from 'fs'

const DIM_MAXIMA = 1024 * 1024

let caleJurnal: string | null = null

function cale(): string {
  if (!caleJurnal) {
    const dir = app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    caleJurnal = join(dir, 'catastif.log')
  }
  return caleJurnal
}

export function caleJurnalAplicatie(): string {
  return cale()
}

function roteste(fisier: string): void {
  try {
    if (existsSync(fisier) && statSync(fisier).size > DIM_MAXIMA) {
      const vechi = `${fisier}.1`
      if (existsSync(vechi)) rmSync(vechi, { force: true })
      renameSync(fisier, vechi)
    }
  } catch {
    // Rotația e o comoditate, nu o obligație: dacă eșuează, continuăm să scriem.
  }
}

function scrie(nivel: string, mesaj: string): void {
  const rand = `${new Date().toISOString()} [${nivel}] ${mesaj}\n`
  // Consola rămâne utilă în dezvoltare, unde chiar există un terminal.
  if (!app.isPackaged) process.stdout.write(rand)
  try {
    const fisier = cale()
    roteste(fisier)
    appendFileSync(fisier, rand, 'utf8')
  } catch {
    // Dacă nici jurnalul nu poate fi scris (disc plin, folder blocat de
    // antivirus), nu avem ce face — dar nu dărâmăm aplicația pentru asta.
  }
}

function text(valori: unknown[]): string {
  return valori
    .map((v) => {
      if (v instanceof Error) return `${v.message}\n${v.stack ?? ''}`
      if (typeof v === 'string') return v
      try {
        return JSON.stringify(v)
      } catch {
        return String(v)
      }
    })
    .join(' ')
}

// Forma așteptată de electron-updater pentru `autoUpdater.logger`.
export const jurnal = {
  info: (...v: unknown[]): void => scrie('INFO', text(v)),
  warn: (...v: unknown[]): void => scrie('WARN', text(v)),
  error: (...v: unknown[]): void => scrie('EROARE', text(v)),
  debug: (...v: unknown[]): void => scrie('DEBUG', text(v))
}
