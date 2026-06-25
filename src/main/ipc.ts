import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron'
import type { BackupResult, Setari } from '@shared/types'
import { getSetari, saveSetari } from './db/repos/setari'
import { backupToSync, rotateBackups, restoreFromSync } from './backup'

export function registerIpc(): void {
  // --- App ---
  ipcMain.handle('app:getVersion', () => app.getVersion())

  // --- Setări ---
  ipcMain.handle('setari:get', () => getSetari())
  ipcMain.handle('setari:save', (_e, patch: Partial<Setari>) => saveSetari(patch))

  // --- Backup ---
  ipcMain.handle('backup:chooseFolder', async (e): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const res = await dialog.showOpenDialog(win!, {
      title: 'Alege folderul pentru backup',
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    const folder = res.filePaths[0]
    saveSetari({ backup_folder: folder })
    return folder
  })

  ipcMain.handle('backup:exportNow', async (e): Promise<BackupResult> => {
    try {
      const s = getSetari()
      let folder = s.backup_folder
      if (!folder) {
        const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
        const res = await dialog.showOpenDialog(win!, {
          title: 'Alege folderul pentru backup',
          properties: ['openDirectory', 'createDirectory']
        })
        if (res.canceled || res.filePaths.length === 0) {
          return { ok: false, mesaj: 'Backup anulat.' }
        }
        folder = res.filePaths[0]
        saveSetari({ backup_folder: folder })
      }
      const cale = backupToSync(folder)
      rotateBackups(folder)
      return { ok: true, cale }
    } catch (err) {
      return { ok: false, mesaj: (err as Error).message }
    }
  })

  ipcMain.handle('backup:importFrom', async (e): Promise<BackupResult> => {
    try {
      const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
      const res = await dialog.showOpenDialog(win!, {
        title: 'Alege folderul de backup pentru restaurare',
        properties: ['openDirectory']
      })
      if (res.canceled || res.filePaths.length === 0) {
        return { ok: false, mesaj: 'Restaurare anulată.' }
      }
      restoreFromSync(res.filePaths[0])
      // Repornim pentru a reîncărca baza restaurată.
      app.relaunch()
      app.exit(0)
      return { ok: true }
    } catch (err) {
      return { ok: false, mesaj: (err as Error).message }
    }
  })

  ipcMain.handle('backup:openFolder', async (): Promise<void> => {
    const s = getSetari()
    if (s.backup_folder) await shell.openPath(s.backup_folder)
  })
}
