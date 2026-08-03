import { app, ipcMain, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { getSetari, saveSetari } from './db/repos/setari'
import { jurnal } from './log'
import type { StareActualizare } from '@shared/types'

// Verificarea la pornire + fluxul cu 3 opțiuni (Da / Nu / Nu pentru această versiune).
//
// Reguli care au stat la baza acestui fișier:
//  - nimic nu se întâmplă în tăcere: fiecare fază ajunge în interfață, inclusiv
//    erorile (altfel un utilizator rămâne pe o versiune veche fără să afle);
//  - aplicația nu se închide niciodată sub mâna omului: instalarea se face doar
//    după un „da” explicit dat DUPĂ ce descărcarea s-a terminat;
//  - starea e păstrată aici, iar interfața o cere la montare — un renderer care
//    pornește mai încet decât prima verificare nu pierde anunțul.

const INTERVAL_REVERIFICARE = 6 * 60 * 60 * 1000 // 6 ore

let stare: StareActualizare = { faza: 'inactiv' }
let versiuneDescarcata: string | null = null
let instalareInCurs = false
let cronometru: NodeJS.Timeout | null = null

// `before-quit` trebuie să sară peste backupul sincron când instalatorul NSIS
// este deja pornit și așteaptă să închidă aplicația — altfel copierea e tăiată
// la jumătate de `taskkill /F` și rămâne un backup incomplet, dar cu nume valid.
export function instalareActualizareInCurs(): boolean {
  return instalareInCurs
}

function setStare(nou: StareActualizare): void {
  stare = nou
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('update:stare', nou)
  }
}

function mesajEroare(err: unknown): string {
  const brut = err instanceof Error ? err.message : String(err)
  // Mesajele electron-updater sunt în engleză și tehnice; le traducem pe cele
  // pe care utilizatorul le poate întâlni realist.
  if (/net::|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED/i.test(brut)) {
    return 'Nu am putut contacta serverul de actualizări. Verifică legătura la internet.'
  }
  if (/ERR_UPDATER_NO_PUBLISHED_VERSIONS|404/i.test(brut)) {
    return 'Nu există încă nicio versiune publicată.'
  }
  if (/sha512|checksum|signature/i.test(brut)) {
    return 'Fișierul descărcat pare deteriorat. Încearcă din nou mai târziu.'
  }
  return brut
}

function conecteazaEvenimente(): void {
  autoUpdater.on('checking-for-update', () => setStare({ faza: 'verificare' }))

  autoUpdater.on('update-available', (info) => {
    const versiune = info.version
    // O versiune pusă deoparte de utilizator nu mai deranjează, dar una mai nouă
    // decât ea da — comparăm pe egalitate, deci orice altă versiune trece.
    if (getSetari().versiune_ignorata === versiune) {
      jurnal.info(`Versiunea ${versiune} este ignorată de utilizator.`)
      setStare({ faza: 'inactiv' })
      return
    }
    setStare({ faza: 'disponibila', versiune })
  })

  autoUpdater.on('update-not-available', () => setStare({ faza: 'la_zi' }))

  autoUpdater.on('download-progress', (p) => {
    setStare({
      faza: 'descarcare',
      versiune: versiuneDescarcata ?? '',
      procent: Math.round(p.percent)
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    versiuneDescarcata = info.version
    // NU instalăm de la sine: utilizatorul poate fi în mijlocul unei comenzi.
    // Îl întrebăm și așteptăm `update:install`.
    setStare({ faza: 'descarcata', versiune: info.version })
  })

  autoUpdater.on('error', (err) => {
    jurnal.error('Actualizare automată:', err)
    // Dacă instalarea nu a apucat să pornească (instalator lipsă, pus în
    // carantină de antivirus), aplicația rămâne deschisă. Fără resetarea asta,
    // steagul ar rămâne ridicat și ar sări peste backupul automat la nesfârșit.
    instalareInCurs = false
    setStare({ faza: 'eroare', mesaj: mesajEroare(err) })
  })
}

// Handlerele IPC se înregistrează o singură dată și indiferent dacă aplicația e
// împachetată: altfel, în dezvoltare, apelurile din interfață ar rămâne
// promisiuni respinse („No handler registered for …”).
export function registerUpdateIpc(): void {
  // `update:getStare` este cererea (invoke), `update:stare` este anunțul (send).
  ipcMain.handle('update:getStare', (): StareActualizare => stare)

  ipcMain.handle('update:check', async (): Promise<void> => {
    if (!app.isPackaged) {
      setStare({
        faza: 'eroare',
        mesaj: 'Actualizările funcționează doar în aplicația instalată, nu în modul dezvoltare.'
      })
      return
    }
    // O verificare pornită peste una în desfășurare ar rescrie starea: bara de
    // progres ar dispărea, apoi ar reapărea întrebarea „Actualizare
    // disponibilă?” în timp ce descărcarea încă rulează.
    if (stare.faza === 'verificare' || stare.faza === 'descarcare' || stare.faza === 'descarcata') {
      setStare(stare)
      return
    }
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      jurnal.error('Verificare actualizări:', err)
      setStare({ faza: 'eroare', mesaj: mesajEroare(err) })
    }
  })

  ipcMain.handle('update:response', async (_e, raspuns: 'da' | 'nu' | 'skip'): Promise<void> => {
    if (raspuns === 'da') {
      if (stare.faza === 'disponibila') versiuneDescarcata = stare.versiune
      setStare({ faza: 'descarcare', versiune: versiuneDescarcata ?? '', procent: 0 })
      try {
        await autoUpdater.downloadUpdate()
      } catch (err) {
        jurnal.error('Descărcare actualizare:', err)
        setStare({ faza: 'eroare', mesaj: mesajEroare(err) })
      }
      return
    }
    if (raspuns === 'skip' && stare.faza === 'disponibila') {
      // Dacă scrierea eșuează (bază blocată, aplicație în curs de închidere),
      // tot trebuie să ieșim din starea „disponibila” — altfel rămâne agățată
      // acolo și nicio verificare ulterioară nu mai pornește.
      try {
        saveSetari({ versiune_ignorata: stare.versiune })
      } catch (err) {
        jurnal.error('Nu am putut reține versiunea ignorată:', err)
      }
    }
    setStare({ faza: 'inactiv' })
  })

  ipcMain.handle('update:install', (_e, cand: 'acum' | 'la_inchidere'): void => {
    // Garda se pune pe stare, nu pe `versiuneDescarcata`: aceasta e completată
    // încă de la începutul descărcării, deci nu dovedește că există ceva pe disc.
    if (stare.faza !== 'descarcata') return
    if (cand === 'la_inchidere') {
      // Nu e nimic de pornit aici: `autoInstallOnAppQuit` e deja `true` de la
      // inițializare (vezi initAutoUpdate), iar electron-updater instalează
      // singur pe `quit`, după ce `will-quit` a terminat backupul.
      setStare({ faza: 'inactiv' })
      jurnal.info('Actualizarea se va instala la următoarea închidere.')
      return
    }
    instalareInCurs = true
    jurnal.info(`Instalez versiunea ${versiuneDescarcata} și repornesc.`)
    // isSilent=true: instalatorul NSIS rulează cu /S, fără expertul cu ferestre
    // (și fără avertismentul SmartScreen pe care mulți utilizatori l-ar anula).
    // Doar în modul silențios electron-updater ține cont de „repornește după”.
    autoUpdater.quitAndInstall(true, true)
  })

  ipcMain.handle('update:clearSkipped', (): void => {
    saveSetari({ versiune_ignorata: null })
    jurnal.info('Lista versiunilor ignorate a fost golită.')
  })
}

export function initAutoUpdate(): void {
  // În dezvoltare nu există fișier de actualizare — nu pornim verificările.
  if (!app.isPackaged) return

  autoUpdater.logger = jurnal
  autoUpdater.autoDownload = false
  // TREBUIE să fie `true` ÎNAINTE de descărcare. electron-updater își pune
  // cârligul de instalare-la-închidere o singură dată, din `executeDownload`,
  // iar `addQuitHandler()` iese imediat dacă `autoInstallOnAppQuit` e fals în
  // clipa aceea (BaseUpdater.js). Setat mai târziu, nu ar mai avea niciun
  // efect, iar „La următoarea închidere” nu ar instala niciodată nimic.
  //
  // Nu e o cursă cu backupul automat: cârligul lor rulează pe `quit`, care vine
  // după `will-quit`, unde facem backupul. Backupul apucă să se termine întreg.
  autoUpdater.autoInstallOnAppQuit = true

  conecteazaEvenimente()

  autoUpdater.checkForUpdates().catch((err) => {
    jurnal.error('Verificare la pornire:', err)
    setStare({ faza: 'eroare', mesaj: mesajEroare(err) })
  })

  // O aplicație ținută deschisă săptămâni la rând ar verifica o singură dată.
  cronometru = setInterval(() => {
    if (stare.faza === 'inactiv' || stare.faza === 'la_zi' || stare.faza === 'eroare') {
      autoUpdater.checkForUpdates().catch((err) => jurnal.error('Reverificare:', err))
    }
  }, INTERVAL_REVERIFICARE)
  cronometru.unref()
}

export function opresteAutoUpdate(): void {
  if (cronometru) {
    clearInterval(cronometru)
    cronometru = null
  }
}
