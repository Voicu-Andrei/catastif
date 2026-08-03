import { app, BrowserWindow, shell, Menu, dialog } from 'electron'
import { join } from 'path'
import { getDb, closeDb, marcheazaInchiderea, esteInInchidere } from './db/connection'
import { getSetari } from './db/repos/setari'
import { backupToSync, rotateBackups } from './backup'
import { registerIpc } from './ipc'
import {
  initAutoUpdate,
  registerUpdateIpc,
  opresteAutoUpdate,
  instalareActualizareInCurs
} from './updater'
import { jurnal, caleJurnalAplicatie } from './log'
import { salveazaStareFereastra, stareInitialaFereastra, dimensiuniMinime } from './fereastra-stare'

let mainWindow: BrowserWindow | null = null
let didShutdown = false

// O a doua instanță ar deschide aceeași bază SQLite: migrațiile s-ar putea
// aplica de două ori, scrierile dintr-o fereastră ar fi invizibile în cealaltă,
// iar un backup la închidere ar prinde datele la mijlocul unei scrieri. Pe
// Windows se întâmplă des — aplicația pornește cu fereastra ascunsă, omul crede
// că nu s-a întâmplat nimic și mai dă o dată clic pe scurtătură.
// Nu ne bazăm pe faptul că `app.exit()` oprește pe loc restul modulului: tot ce
// urmează (inclusiv deschiderea bazei) stă într-un `else`, ca a doua instanță să
// nu apuce să atingă nimic, indiferent de ordinea internă a Electron.
const suntemSinguraInstanta = app.requestSingleInstanceLock()

if (!suntemSinguraInstanta) {
  app.exit(0)
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  porneste()
}

let seInchideCuEroare = false

// Atenție: NU aruncă. Odată ce bucla de mesaje rulează, `app.exit()` nu
// termină procesul pe loc, ci se întoarce în JavaScript — iar o aruncare de
// aici ar ajunge în `uncaughtException`, care ar deschide o a doua casetă de
// eroare, cu alt text, peste prima. Apelanții se opresc singuri (`return`).
function inchideCuEroare(titlu: string, mesaj: string, err: unknown): void {
  if (seInchideCuEroare) return
  seInchideCuEroare = true

  jurnal.error(`${titlu}:`, err)
  dialog.showErrorBox(titlu, `${mesaj}\n\nDetalii în:\n${caleJurnalAplicatie()}`)
  try {
    marcheazaInchiderea()
    closeDb()
  } catch {
    // Nu mai avem ce salva; important e să nu rămână procesul agățat.
  }
  app.exit(1)
}

// O eroare neprinsă în procesul principal nu trebuie să lase în urmă un proces
// fără fereastră: utilizatorul nu-l vede, dar el ține baza deschisă, iar
// următoarea pornire dă peste o bază blocată.
process.on('uncaughtException', (err) => {
  inchideCuEroare(
    'Catastif — eroare neașteptată',
    'A apărut o eroare neașteptată și aplicația trebuie închisă. ' +
      'Datele tale sunt salvate pe disc.\n\n' +
      String(err?.message ?? err),
    err
  )
})

// O promisiune respinsă NU este motiv de închidere. Multe sunt periferice —
// `shell.openExternal` respinge pe un Windows fără browser implicit — și a
// închide aplicația pentru asta ar sări peste backupul automat și ar arunca
// munca nesalvată. O notăm în jurnal și mergem mai departe.
process.on('unhandledRejection', (motiv) => {
  jurnal.error('Promisiune respinsă netratată:', motiv)
})

function createWindow(): void {
  const stare = stareInitialaFereastra()

  mainWindow = new BrowserWindow({
    x: stare.x,
    y: stare.y,
    width: stare.width,
    height: stare.height,
    minWidth: dimensiuniMinime.LATIME_MINIMA,
    minHeight: dimensiuniMinime.INALTIME_MINIMA,
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
  const fereastra = mainWindow

  // `maximize()` afișează fereastra chiar dacă e încă ascunsă, așa că nu poate
  // fi chemat la construcție: utilizatorul care lucrează maximizat (cazul
  // obișnuit) ar vedea un dreptunghi gol pe tot ecranul cât durează pornirea
  // interfeței. Îl amânăm până când chiar e ceva de arătat.
  fereastra.on('ready-to-show', () => {
    if (stare.maximizata) fereastra.maximize()
    else fereastra.show()
  })

  // Plasă de siguranță: dacă `ready-to-show` nu vine (bundle deteriorat de o
  // actualizare întreruptă, fișier pus în carantină de antivirus), aplicația ar
  // rămâne un proces invizibil. Mai bine o fereastră goală decât niciuna.
  const asteptareAfisare = setTimeout(() => {
    if (!fereastra.isDestroyed() && !fereastra.isVisible()) {
      jurnal.warn('`ready-to-show` nu a apărut în 10 s — afișez fereastra oricum.')
      fereastra.show()
    }
  }, 10_000)
  // `unref` ca temporizatorul să nu țină procesul în viață la închidere.
  asteptareAfisare.unref()
  fereastra.on('show', () => clearTimeout(asteptareAfisare))
  fereastra.on('closed', () => clearTimeout(asteptareAfisare))

  fereastra.webContents.on('did-fail-load', (_e, cod, descriere, url, esteCadruPrincipal) => {
    // ERR_ABORTED (-3) înseamnă doar că o încărcare a fost înlocuită de alta —
    // exact ce se întâmplă la fiecare `reload()`, inclusiv la cel oferit după o
    // prăbușire a interfeței. Nu e o eroare, cu atât mai puțin una fatală.
    if (!esteCadruPrincipal || cod === -3 || cod === 0) return
    inchideCuEroare(
      'Catastif — interfața nu a putut fi încărcată',
      'Fișierele aplicației par deteriorate. Reinstalează Catastif — ' +
        'datele tale nu sunt afectate.\n\n' +
        `${descriere} (${cod})\n${url}`,
      new Error(`did-fail-load ${cod} ${descriere} ${url}`)
    )
  })

  // Un renderer mort lasă o fereastră albă care arată perfect funcțională.
  fereastra.webContents.on('render-process-gone', (_e, detalii) => {
    jurnal.error('Procesul de interfață s-a oprit:', detalii.reason)
    const raspuns = dialog.showMessageBoxSync(fereastra, {
      type: 'error',
      title: 'Catastif',
      message: 'Interfața aplicației s-a oprit neașteptat.',
      detail: 'Datele salvate până acum sunt în siguranță. Vrei să reîncarci aplicația?',
      buttons: ['Reîncarcă', 'Închide aplicația'],
      defaultId: 0,
      cancelId: 1
    })
    if (raspuns === 0) fereastra.reload()
    else app.quit()
  })

  fereastra.on('unresponsive', () => jurnal.warn('Fereastra nu răspunde.'))

  fereastra.on('close', () => salveazaStareFereastra(fereastra))
  fereastra.on('closed', () => {
    mainWindow = null
  })

  fereastra.webContents.setWindowOpenHandler((details) => {
    shell
      .openExternal(details.url)
      .catch((err) => jurnal.warn(`Nu am putut deschide legătura ${details.url}:`, err))
    return { action: 'deny' }
  })

  const incarcare = process.env['ELECTRON_RENDERER_URL']
    ? fereastra.loadURL(process.env['ELECTRON_RENDERER_URL'])
    : fereastra.loadFile(join(__dirname, '../renderer/index.html'))
  incarcare.catch((err) => jurnal.error('Încărcarea interfeței a eșuat:', err))
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

function porneste(): void {
  app
    .whenReady()
    .then(() => {
      // Fără asta, Windows nu leagă fereastra de scurtătura fixată în bara de
      // activități: apar două pictograme, iar notificările nu au identitate.
      // Trebuie să fie exact `appId` din electron-builder.yml.
      if (process.platform === 'win32') app.setAppUserModelId('ro.catastif.app')

      jurnal.info(`Catastif ${app.getVersion()} pornește (${process.platform}).`)

      configureazaMeniu()
      // Canalele de actualizare se înregistrează înaintea bazei: chiar dacă baza
      // nu poate fi deschisă, interfața trebuie să poată cere starea fără să crape.
      registerUpdateIpc()

      try {
        // Inițializează baza + rulează migrațiile devreme.
        getDb()
      } catch (err) {
        inchideCuEroare(
          'Catastif — baza de date nu poate fi deschisă',
          String(err instanceof Error ? err.message : err),
          err
        )
        return
      }

      registerIpc()
      createWindow()
      initAutoUpdate()

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
      })
    })
    // Fără asta, orice eroare de după deschiderea bazei (înregistrarea IPC,
    // crearea ferestrei) ar deveni o promisiune respinsă — doar notată în
    // jurnal — lăsând un proces fără fereastră, pe care utilizatorul nu-l vede
    // și care ține baza deschisă. Aici chiar trebuie să închidem.
    .catch((err) =>
      inchideCuEroare(
        'Catastif — pornirea a eșuat',
        'Aplicația nu a putut porni. Datele tale nu sunt afectate.\n\n' +
          String(err instanceof Error ? err.message : err),
        err
      )
    )
}

// Backup automat la închidere (dacă e activat) + închidere curată a bazei.
//
// Rulează pe `will-quit`, nu pe `before-quit`: acolo ferestrele sunt deja
// închise, deci interfața nu mai poate trimite un ultim mesaj IPC care să
// redeschidă baza după ce am închis-o (și care ar lipsi din backup).
app.on('will-quit', () => {
  if (didShutdown) return
  didShutdown = true
  opresteAutoUpdate()
  try {
    // Când instalatorul actualizării e deja pornit, el închide forțat aplicația
    // după câteva secunde. Un backup pornit acum ar fi tăiat la jumătate și ar
    // rămâne pe disc arătând ca unul bun — mai bine îl sărim.
    if (instalareActualizareInCurs()) {
      jurnal.info('Instalare în curs — sar peste backupul automat.')
    } else if (esteInInchidere()) {
      // Restaurare tocmai încheiată: baza de pe disc este cea din backup. Un
      // backup al ei acum ar fi redundant, iar rotația ar putea șterge exact
      // folderul din care utilizatorul tocmai a restaurat.
      jurnal.info('Restaurare în curs — sar peste backupul automat.')
    } else {
      const s = getSetari()
      if (s.auto_backup && s.backup_folder) {
        const cale = backupToSync(s.backup_folder)
        rotateBackups(s.backup_folder)
        jurnal.info(`Backup automat: ${cale}`)
      }
    }
  } catch (err) {
    jurnal.error('Backup automat eșuat:', err)
  }
  // Abia acum blocăm redeschiderea bazei: backupul de mai sus are nevoie de ea.
  marcheazaInchiderea()
  closeDb()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
