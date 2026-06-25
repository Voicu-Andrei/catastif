import { app, BrowserWindow, shell, Menu } from 'electron'
import { join } from 'path'
import { getDb, closeDb } from './db/connection'
import { getSetari } from './db/repos/setari'
import { backupToSync, rotateBackups } from './backup'
import { registerIpc } from './ipc'
import { initAutoUpdate } from './updater'

let mainWindow: BrowserWindow | null = null
let didShutdown = false

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

app.whenReady().then(() => {
  // Inițializează baza + rulează migrațiile devreme.
  getDb()
  registerIpc()
  Menu.setApplicationMenu(null)
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
