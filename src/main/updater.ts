import { app, ipcMain, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { getSetari, saveSetari } from './db/repos/setari'
import type { RezultatVerificare } from '@shared/types'

let pendingVersion: string | null = null
let ultimaEroare: string | null = null
let fereastra: BrowserWindow | null = null

// Trimite anunțul spre interfață DOAR după ce pagina e încărcată.
// Fără asta, verificarea (rapidă, de rețea) se termina adesea înainte ca React
// să apuce să monteze componenta care ascultă — mesajul se pierdea în gol și
// fereastra de actualizare nu apărea niciodată.
function anuntaRenderer(): void {
  const win = fereastra
  if (!win || win.isDestroyed() || !pendingVersion) return
  const trimite = (): void => {
    if (!win.isDestroyed() && pendingVersion) {
      win.webContents.send('update:available', { version: pendingVersion })
    }
  }
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', trimite)
  else trimite()
}

// Verificare la cerere (butonul din Setări). Spre deosebire de cea automată,
// ignoră „sări peste această versiune" — utilizatorul a cerut explicit.
export async function verificaActualizari(): Promise<RezultatVerificare> {
  const versiuneCurenta = app.getVersion()
  if (!app.isPackaged) {
    return { stare: 'dezvoltare', versiuneCurenta }
  }
  ultimaEroare = null
  try {
    const rezultat = await autoUpdater.checkForUpdates()
    if (rezultat?.isUpdateAvailable) {
      pendingVersion = rezultat.updateInfo.version
      anuntaRenderer()
      return { stare: 'disponibila', versiuneCurenta, versiune: rezultat.updateInfo.version }
    }
    if (ultimaEroare) return { stare: 'eroare', versiuneCurenta, mesaj: ultimaEroare }
    return { stare: 'la_zi', versiuneCurenta }
  } catch (err) {
    return { stare: 'eroare', versiuneCurenta, mesaj: (err as Error).message }
  }
}

export function initAutoUpdate(win: BrowserWindow): void {
  fereastra = win

  // Handlerele se înregistrează ÎNTOTDEAUNA, inclusiv în dezvoltare — altfel
  // butonul din Setări ar da „No handler registered for 'update:check'".
  ipcMain.handle('update:check', () => verificaActualizari())

  // Interfața întreabă la montare dacă există deja o actualizare găsită.
  // Împreună cu anuntaRenderer() acoperă ambele ordini posibile de pornire.
  ipcMain.handle('update:pending', () =>
    pendingVersion && getSetari().versiune_ignorata !== pendingVersion
      ? { version: pendingVersion }
      : null
  )

  ipcMain.handle('update:response', (_e, raspuns: 'da' | 'nu' | 'skip') => {
    if (raspuns === 'da' && app.isPackaged) {
      autoUpdater.downloadUpdate().catch((e) => console.error('downloadUpdate:', e))
    } else if (raspuns === 'skip' && pendingVersion) {
      saveSetari({ versiune_ignorata: pendingVersion })
      pendingVersion = null
    }
  })

  // În dezvoltare nu există fișier de actualizare — restul nu are sens.
  if (!app.isPackaged) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    if (getSetari().versiune_ignorata === info.version) return // ignorată anterior
    pendingVersion = info.version
    anuntaRenderer()
  })

  autoUpdater.on('update-downloaded', () => {
    // Repornește și instalează, după ce utilizatorul a ales „Da”.
    autoUpdater.quitAndInstall(false, true)
  })

  autoUpdater.on('error', (err) => {
    ultimaEroare = String(err?.message ?? err)
    console.error('Eroare actualizare automată:', err)
  })

  autoUpdater.checkForUpdates().catch((e) => {
    ultimaEroare = String(e?.message ?? e)
    console.error('checkForUpdates:', e)
  })
}
