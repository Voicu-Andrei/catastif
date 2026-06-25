import { app, ipcMain, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { getSetari, saveSetari } from './db/repos/setari'

let pendingVersion: string | null = null

// Verificare la pornire + fluxul cu 3 opțiuni (Da / Nu / Nu pentru această versiune).
export function initAutoUpdate(win: BrowserWindow): void {
  // În dezvoltare nu există fișier de actualizare — sărim complet.
  if (!app.isPackaged) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    const v = info.version
    if (getSetari().versiune_ignorata === v) return // versiune ignorată anterior
    pendingVersion = v
    if (!win.isDestroyed()) win.webContents.send('update:available', { version: v })
  })

  autoUpdater.on('update-downloaded', () => {
    // Reporneste și instalează după ce utilizatorul a ales „Da”.
    autoUpdater.quitAndInstall(false, true)
  })

  autoUpdater.on('error', (err) => {
    console.error('Eroare actualizare automată:', err)
  })

  ipcMain.handle('update:response', (_e, raspuns: 'da' | 'nu' | 'skip') => {
    if (raspuns === 'da') {
      autoUpdater.downloadUpdate().catch((e) => console.error(e))
    } else if (raspuns === 'skip' && pendingVersion) {
      saveSetari({ versiune_ignorata: pendingVersion })
    }
  })

  autoUpdater.checkForUpdates().catch((e) => console.error('checkForUpdates:', e))
}
