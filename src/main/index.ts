import { app, BrowserWindow, shell, Menu, dialog } from 'electron'
import { join } from 'path'
import { getDb, closeDb } from './db/connection'
import { getSetari } from './db/repos/setari'
import { backupToSync, rotateBackups } from './backup'
import { registerIpc } from './ipc'
import { initAutoUpdate } from './updater'

let mainWindow: BrowserWindow | null = null
let didShutdown = false

// O eroare neprinsă în procesul principal nu trebuie să închidă aplicația brusc
// (baza rămâne consistentă prin WAL, dar utilizatorul merită un mesaj clar).
process.on('uncaughtException', (err) => {
  console.error('Eroare neașteptată în procesul principal:', err)
  dialog.showErrorBox(
    'Catastif — eroare neașteptată',
    'A apărut o eroare neașteptată. Datele tale sunt salvate pe disc.\n\n' + String(err?.message ?? err)
  )
})

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'Catastif',
    backgroundColor: '#f6f8f8',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Pe Windows/Linux ascundem meniul (autoHideMenuBar). Pe macOS un meniu de
// aplicație este OBLIGATORIU: fără el, scurtăturile standard (Cmd+C/V/X/A,
// Cmd+Q) nu funcționează deloc în câmpurile de text.
function configureazaMeniu(): void {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: 'hide', label: 'Ascunde Catastif' },
          { role: 'unhide', label: 'Arată tot' },
          { type: 'separator' },
          { role: 'quit', label: 'Închide Catastif' }
        ]
      },
      {
        label: 'Editare',
        submenu: [
          { role: 'undo', label: 'Anulează' },
          { role: 'redo', label: 'Refă' },
          { type: 'separator' },
          { role: 'cut', label: 'Decupează' },
          { role: 'copy', label: 'Copiază' },
          { role: 'paste', label: 'Lipește' },
          { role: 'selectAll', label: 'Selectează tot' }
        ]
      },
      {
        label: 'Fereastră',
        submenu: [
          { role: 'minimize', label: 'Minimizează' },
          { role: 'zoom', label: 'Mărește' },
          { role: 'close', label: 'Închide fereastra' }
        ]
      }
    ])
  )
}

app.whenReady().then(() => {
  // Inițializează baza + rulează migrațiile devreme.
  getDb()
  registerIpc()
  configureazaMeniu()
  createWindow()
  if (mainWindow) initAutoUpdate(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Backup automat la închidere (dacă e activat) + închidere curată a bazei.
app.on('before-quit', () => {
  if (didShutdown) return
  didShutdown = true
  try {
    const s = getSetari()
    if (s.auto_backup && s.backup_folder) {
      backupToSync(s.backup_folder)
      rotateBackups(s.backup_folder)
    }
  } catch (err) {
    console.error('Backup automat eșuat:', err)
  }
  closeDb()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
