import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron'
import type { BackupResult, Setari } from '@shared/types'
import type { EntitateTip, ExportFormat } from '@shared/types'
import { getSetari, saveSetari } from './db/repos/setari'
import { backupToSync, rotateBackups, restoreFromSync } from './backup'
import { registerEntitiesIpc } from './ipc-entities'
import { getDashboard } from './db/repos/dashboard'
import { searchGlobal } from './db/repos/search'
import { listFisiere, attachFisiere, openFisier, deleteFisier } from './files'
import { getRapoarte } from './db/repos/rapoarte'
import { exportTabel } from './export'
import { generatePdfComanda, generatePdfRaport } from './pdf'
import { alegeLogo, logoDataUri, stergeLogo } from './logo'
import { resetBaza } from './db/reset'

function winFrom(e: Electron.IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(e.sender) ?? undefined
}

export function registerIpc(): void {
  registerEntitiesIpc()

  // --- App ---
  ipcMain.handle('app:getVersion', () => app.getVersion())

  // --- Dashboard & căutare ---
  ipcMain.handle('dashboard:get', () => getDashboard())
  ipcMain.handle('search:global', (_e, q: string) => searchGlobal(q))

  // --- Fișiere (atașamente) ---
  ipcMain.handle('fisiere:list', (_e, tip: EntitateTip, id: number) => listFisiere(tip, id))
  ipcMain.handle('fisiere:attach', (e, tip: EntitateTip, id: number) =>
    attachFisiere(BrowserWindow.fromWebContents(e.sender) ?? undefined, tip, id)
  )
  ipcMain.handle('fisiere:open', (_e, id: number) => openFisier(id))
  ipcMain.handle('fisiere:delete', (_e, id: number) => deleteFisier(id))

  // --- Rapoarte, export, PDF ---
  ipcMain.handle('rapoarte:get', (_e, an: number) => getRapoarte(an))
  ipcMain.handle(
    'export:tabel',
    (e, format: ExportFormat, nume: string, headers: string[], rows: (string | number)[][]) =>
      exportTabel(winFrom(e), format, nume, headers, rows)
  )
  ipcMain.handle('pdf:comanda', (e, id: number) => generatePdfComanda(winFrom(e), id))
  ipcMain.handle('pdf:raport', (e, an: number) => generatePdfRaport(winFrom(e), an))

  // --- Setări ---
  ipcMain.handle('setari:get', () => getSetari())
  ipcMain.handle('setari:save', (_e, patch: Partial<Setari>) => saveSetari(patch))
  ipcMain.handle('setari:logo', () => logoDataUri())
  ipcMain.handle('setari:alegeLogo', (e) => alegeLogo(winFrom(e)))
  ipcMain.handle('setari:stergeLogo', () => stergeLogo())
  ipcMain.handle('setari:resetBaza', () => resetBaza())

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
