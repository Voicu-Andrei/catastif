import { dialog, type BrowserWindow } from 'electron'
import { join, extname } from 'path'
import { existsSync, mkdirSync, copyFileSync, readFileSync, rmSync } from 'fs'
import { attachmentsDir } from './backup'
import { getSetari, saveSetari } from './db/repos/setari'

// Logo-ul firmei este copiat în folderul gestionat de aplicație (același care
// intră în backup), iar în setări păstrăm o cale RELATIVĂ. Astfel un backup
// restaurat pe alt calculator — cu alt nume de utilizator — găsește logo-ul.
const SUBFOLDER = '_firma'

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml'
}

export function logoDir(): string {
  return join(attachmentsDir(), SUBFOLDER)
}

// Calea absolută a logo-ului curent, dacă există pe disc.
export function logoAbsolut(): string | null {
  const rel = getSetari().logo_path
  if (!rel) return null
  const cale = join(attachmentsDir(), rel)
  return existsSync(cale) ? cale : null
}

// Logo-ul ca data:URI — folosit atât la previzualizarea din Setări, cât și în
// PDF-uri (astfel fereastra de tipărire nu are nevoie de acces la fișiere).
export function logoDataUri(cale?: string | null): string | null {
  const fisier = cale ?? logoAbsolut()
  if (!fisier) return null
  const tip = MIME[extname(fisier).slice(1).toLowerCase()]
  if (!tip) return null
  try {
    return `data:${tip};base64,${readFileSync(fisier).toString('base64')}`
  } catch {
    return null
  }
}

// Alege un fișier imagine, îl copiază în folderul aplicației și îl salvează în setări.
export async function alegeLogo(win: BrowserWindow | undefined): Promise<string | null> {
  const res = await dialog.showOpenDialog(win!, {
    title: 'Alege logo-ul firmei',
    properties: ['openFile'],
    filters: [{ name: 'Imagini', extensions: Object.keys(MIME) }]
  })
  if (res.canceled || res.filePaths.length === 0) return logoDataUri()

  const sursa = res.filePaths[0]
  const ext = extname(sursa).slice(1).toLowerCase()
  if (!MIME[ext]) {
    throw new Error('Format de imagine nesuportat. Folosește PNG, JPG, GIF, WEBP sau SVG.')
  }

  // Un singur logo: golim folderul ca să nu rămână variante vechi.
  stergeFisierele()
  mkdirSync(logoDir(), { recursive: true })
  const rel = join(SUBFOLDER, `logo.${ext}`)
  copyFileSync(sursa, join(attachmentsDir(), rel))
  saveSetari({ logo_path: rel })
  return logoDataUri()
}

function stergeFisierele(): void {
  const dir = logoDir()
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}

export function stergeLogo(): void {
  stergeFisierele()
  saveSetari({ logo_path: null })
}
