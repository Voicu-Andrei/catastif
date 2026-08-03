import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron'
import type { BackupResult, Setari } from '@shared/types'
import type { EntitateTip, ExportFormat } from '@shared/types'
import { getSetari, saveSetari } from './db/repos/setari'
import { backupToSync, rotateBackups, restoreFromSync } from './backup'
import { marcheazaInchiderea } from './db/connection'
import { registerEntitiesIpc } from './ipc-entities'
import { getDashboard } from './db/repos/dashboard'
import { searchGlobal } from './db/repos/search'
import { listFisiere, attachFisiere, openFisier, deleteFisier } from './files'
import { getRapoarte } from './db/repos/rapoarte'
import { exportTabel } from './export'
import {
  generatePdfComanda,
  generatePdfRaport,
  previzualizeazaPdfComanda,
  previzualizeazaPdfRaport
} from './pdf'

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
  ipcMain.handle('pdf:previzualizeazaComanda', (e, id: number) =>
    previzualizeazaPdfComanda(winFrom(e), id)
  )
  ipcMain.handle('pdf:previzualizeazaRaport', (e, an: number) =>
    previzualizeazaPdfRaport(winFrom(e), an)
  )

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
      // Baza tocmai a fost înlocuită și conexiunea închisă. Fără marcajul ăsta,
      // `will-quit` ar chema `getSetari()`, ar redeschide baza restaurată, ar
      // face un backup automat al ei și — prin rotație — ar putea șterge exact
      // backupul din care tocmai s-a restaurat.
      marcheazaInchiderea()
      // Repornim pentru a reîncărca baza restaurată. `app.quit()`, nu
      // `app.exit()`: exit sare peste `will-quit`, deci peste închiderea curată
      // a bazei, iar procesul nou ar putea găsi fișierul încă blocat.
      // Repornirea o programăm după ce răspunsul ajunge în interfață, altfel
      // promisiunea nu se rezolvă niciodată și utilizatorul nu află nimic.
      setTimeout(() => {
        app.relaunch({ args: process.argv.slice(1) })
        app.quit()
      }, 400)
      return { ok: true, mesaj: 'Datele au fost restaurate. Aplicația se repornește…' }
    } catch (err) {
      return { ok: false, mesaj: (err as Error).message }
    }
  })

  ipcMain.handle('backup:openFolder', async (): Promise<void> => {
    const s = getSetari()
    if (!s.backup_folder) return
    // shell.openPath întoarce un mesaj de eroare în loc să respingă promisiunea.
    const eroare = await shell.openPath(s.backup_folder)
    if (eroare) {
      throw new Error(
        `Folderul de backup nu poate fi deschis. Verifică dacă mai există (stick scos, folder mutat sau OneDrive deconectat).\n${eroare}`
      )
    }
  })
}
