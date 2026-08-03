// Poziția și dimensiunea ferestrei, ținute minte între porniri.
//
// Stau într-un fișier JSON separat, nu în baza de date: fereastra trebuie să se
// poată deschide și atunci când baza nu poate fi citită (altfel utilizatorul nu
// ar avea unde să vadă mesajul de eroare).

import { app, screen, type BrowserWindow, type Rectangle } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { jurnal } from './log'

export interface StareFereastra {
  x?: number
  y?: number
  width: number
  height: number
  maximizata: boolean
}

const LATIME_MINIMA = 960
const INALTIME_MINIMA = 600

function cale(): string {
  return join(app.getPath('userData'), 'fereastra.json')
}

function citeste(): StareFereastra | null {
  try {
    const s = JSON.parse(readFileSync(cale(), 'utf8')) as StareFereastra
    if (typeof s.width !== 'number' || typeof s.height !== 'number') return null
    return s
  } catch {
    return null
  }
}

export function salveazaStareFereastra(win: BrowserWindow): void {
  try {
    if (win.isDestroyed()) return
    const b = win.getNormalBounds()
    const stare: StareFereastra = {
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      maximizata: win.isMaximized()
    }
    writeFileSync(cale(), JSON.stringify(stare), 'utf8')
  } catch (err) {
    jurnal.warn('Nu am putut salva starea ferestrei:', err)
  }
}

// O fereastră salvată pe un monitor care între timp a fost deconectat ar
// reapărea în afara ecranului — vizibilă în bara de activități, dar de negăsit.
// De aceea verificăm de fiecare dată că dreptunghiul chiar atinge un ecran.
function esteVizibila(b: Rectangle): boolean {
  return screen.getAllDisplays().some((d) => {
    const w = d.workArea
    return (
      b.x < w.x + w.width && b.x + b.width > w.x && b.y < w.y + w.height && b.y + b.height > w.y
    )
  })
}

export function stareInitialaFereastra(): StareFereastra {
  const zona = screen.getPrimaryDisplay().workArea
  // Pe un laptop de 1366×768 (sau la scalare 150%, foarte des întâlnită pe
  // Windows) o fereastră de 1280×820 ar intra sub bara de activități.
  const implicita: StareFereastra = {
    width: Math.min(1280, Math.max(LATIME_MINIMA, zona.width - 80)),
    height: Math.min(820, Math.max(INALTIME_MINIMA, zona.height - 80)),
    maximizata: false
  }

  const salvata = citeste()
  if (!salvata) return implicita

  const b: Rectangle = {
    x: salvata.x ?? zona.x,
    y: salvata.y ?? zona.y,
    width: Math.max(LATIME_MINIMA, Math.min(salvata.width, zona.width)),
    height: Math.max(INALTIME_MINIMA, Math.min(salvata.height, zona.height))
  }
  if (!esteVizibila(b)) return { ...implicita, maximizata: salvata.maximizata }

  return { x: b.x, y: b.y, width: b.width, height: b.height, maximizata: salvata.maximizata }
}

export const dimensiuniMinime = { LATIME_MINIMA, INALTIME_MINIMA }
