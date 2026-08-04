import { BrowserWindow, dialog, shell } from 'electron'
import { writeFileSync, existsSync, readFileSync, rmSync } from 'fs'
import { extname, join } from 'path'
import { tmpdir } from 'os'
import { pathToFileURL } from 'url'
import { getComanda } from './db/repos/comenzi'
import { getClient } from './db/repos/clienti'
import { getSetari } from './db/repos/setari'
import { getRapoarte } from './db/repos/rapoarte'
import { calcLinie } from '@shared/calc'
import { etichetaUm } from '@shared/um'
import { numeFisierSigur } from './nume-fisier'
import { jurnal } from './log'
import type { BackupResult, ComandaDetaliu, Client, Setari } from '@shared/types'

const lei = (b: number): string =>
  (b / 100).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' lei'

const dataRo = (iso: string | null): string => {
  if (!iso) return ''
  const d = new Date(iso.includes('T') || iso.includes(' ') ? iso : `${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ro-RO')
}

const esc = (s: string | null | undefined): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  )

const LUNI = [
  'Ianuarie',
  'Februarie',
  'Martie',
  'Aprilie',
  'Mai',
  'Iunie',
  'Iulie',
  'August',
  'Septembrie',
  'Octombrie',
  'Noiembrie',
  'Decembrie'
]

const STIL = `
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; font-size: 12px; margin: 0; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.5px; }
  .muted { color: #666; }
  .row { display: flex; justify-content: space-between; gap: 24px; }
  .box { border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #eee; }
  th { background: #f5f7f7; font-weight: 600; }
  td.r, th.r { text-align: right; }
  .totals { margin-top: 14px; width: 280px; margin-left: auto; }
  .totals td { border: none; padding: 3px 8px; }
  .grand { font-weight: 700; font-size: 14px; border-top: 1px solid #ccc; }
  .brand { color: #00745e; font-weight: 700; }
  h2 { font-size: 15px; margin: 22px 0 0; }
`

// Logo-ul e citit de pe disc și încorporat direct în HTML, ca fereastra de
// tipărire să nu aibă nevoie de acces la fișiere locale (webSecurity rămâne activ).
function logoDataUri(cale: string): string | null {
  const mime: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml'
  }
  const tip = mime[extname(cale).slice(1).toLowerCase()]
  if (!tip) return null
  try {
    return `data:${tip};base64,${readFileSync(cale).toString('base64')}`
  } catch {
    return null
  }
}

function antet(s: Setari): string {
  const logoSrc = s.logo_path && existsSync(s.logo_path) ? logoDataUri(s.logo_path) : null
  const logo = logoSrc
    ? `<img src="${logoSrc}" style="max-height:56px;max-width:200px" />`
    : `<div class="brand" style="font-size:20px">${esc(s.nume_firma || 'Catastif')}</div>`
  const linii = [
    s.cui && `CUI: ${esc(s.cui)}`,
    s.nr_reg_com && `Reg. Com.: ${esc(s.nr_reg_com)}`,
    s.adresa && esc(s.adresa),
    [s.oras, s.judet].filter(Boolean).map(esc).join(', '),
    s.iban && `IBAN: ${esc(s.iban)}`,
    [s.telefon, s.email].filter(Boolean).map(esc).join(' · ')
  ]
    .filter(Boolean)
    .join('<br/>')
  return `<div>${logo}<div class="muted" style="margin-top:6px">${linii}</div></div>`
}

function comandaHtml(s: Setari, c: ComandaDetaliu, client: Client | null): string {
  const titlu =
    c.stare === 'oferta' ? 'OFERTĂ' : c.stare === 'anulata' ? 'COMANDĂ (ANULATĂ)' : 'COMANDĂ'
  const cumparator = client
    ? [
        `<b>${esc(client.nume)}</b>`,
        client.cui && `CUI: ${esc(client.cui)}`,
        client.cnp && `CNP: ${esc(client.cnp)}`,
        client.adresa && esc(client.adresa),
        [client.oras, client.judet].filter(Boolean).map(esc).join(', ')
      ]
        .filter(Boolean)
        .join('<br/>')
    : '<span class="muted">Fără client</span>'

  const randuri = c.linii
    .map((l, i) => {
      const net = calcLinie({
        cantitate: l.cantitate,
        cost_unitar: l.cost_unitar,
        pret_unitar: l.pret_unitar,
        cota_tva: l.cota_tva
      }).net
      return `<tr>
        <td>${i + 1}</td>
        <td>${esc(l.descriere)}</td>
        <td class="r">${l.cantitate}</td>
        <td>${esc(etichetaUm(l.unitate_masura))}</td>
        <td class="r">${lei(l.pret_unitar)}</td>
        <td class="r">${l.cota_tva}%</td>
        <td class="r">${lei(net)}</td>
      </tr>`
    })
    .join('')

  const plati =
    c.stare !== 'oferta'
      ? `<tr><td>Achitat</td><td class="r">${lei(c.achitat)}</td></tr>
         <tr><td>Rest de plată</td><td class="r">${lei(c.rest_de_plata)}</td></tr>`
      : ''

  // Data montajului ajunge pe documentul clientului — el trebuie să citească de
  // pe hârtia primită când vine echipa. Pe o comandă anulată o ascundem
  // (lucrarea nu mai are loc), dar un montaj deja efectuat rămâne: e un fapt.
  const randMontaj =
    c.data_montaj && c.stare !== 'anulata' ? `<br/>Montaj: ${dataRo(c.data_montaj)}` : ''
  const randMontajEfectuat = c.montaj_finalizat_la
    ? `<br/>Montaj efectuat: ${dataRo(c.montaj_finalizat_la)}`
    : ''
  // `detalii_montaj` NU apare niciodată aici: e nota internă a echipei
  // („etaj 4, fără lift, cheia la vecin”), nu informație pentru client.
  const casetaAdresaMontaj = c.adresa_montaj
    ? `<div class="box" style="flex:1"><div class="muted" style="margin-bottom:4px">Adresa de montaj</div>${esc(
        c.adresa_montaj
      )}</div>`
    : ''

  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><style>${STIL}</style></head><body>
    <div class="row" style="align-items:flex-start">
      ${antet(s)}
      <div style="text-align:right">
        <h1>${titlu}</h1>
        <div class="muted">Nr. ${esc(c.numar ?? '#' + c.id)}<br/>Data: ${dataRo(
          c.data_creare
        )}${randMontaj}${randMontajEfectuat}</div>
      </div>
    </div>
    <div class="row" style="margin-top:18px">
      <div class="box" style="flex:1"><div class="muted" style="margin-bottom:4px">Cumpărător</div>${cumparator}</div>
      ${casetaAdresaMontaj}
    </div>
    <table>
      <thead><tr>
        <th>#</th><th>Descriere</th><th class="r">Cant.</th><th>U.M.</th>
        <th class="r">Preț fără TVA</th><th class="r">TVA</th><th class="r">Valoare</th>
      </tr></thead>
      <tbody>${randuri}</tbody>
    </table>
    <table class="totals">
      <tr><td>Total fără TVA</td><td class="r">${lei(c.total_fara_tva)}</td></tr>
      <tr><td>TVA</td><td class="r">${lei(c.total_tva)}</td></tr>
      <tr class="grand"><td>TOTAL</td><td class="r">${lei(c.total)}</td></tr>
      ${plati}
    </table>
    ${c.observatii ? `<p class="muted" style="margin-top:18px">${esc(c.observatii)}</p>` : ''}
  </body></html>`
}

function raportHtml(an: number): string {
  const d = getRapoarte(an)
  const vanzari = d.vanzari_lunare
    .map(
      (m) =>
        `<tr><td>${LUNI[Number(m.luna) - 1]}</td><td class="r">${lei(m.total_fara_tva)}</td><td class="r">${lei(
          m.profit
        )}</td></tr>`
    )
    .join('')
  const clienti = d.profit_pe_client
    .map(
      (c) =>
        `<tr><td>${esc(c.client)}</td><td class="r">${lei(c.total)}</td><td class="r">${lei(c.profit)}</td></tr>`
    )
    .join('')
  const furnizori = d.achizitii_pe_furnizor
    .map((f) => `<tr><td>${esc(f.furnizor)}</td><td class="r">${lei(f.total)}</td></tr>`)
    .join('')
  const incasari = d.de_incasat
    .map(
      (r) =>
        `<tr><td>${esc(r.numar ?? '#' + r.id)}</td><td>${esc(r.client ?? '—')}</td><td class="r">${lei(
          r.rest
        )}</td></tr>`
    )
    .join('')

  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><style>${STIL}</style></head><body>
    <h1>Raport ${an}</h1>
    <h2>Vânzări lunare</h2>
    <table><thead><tr><th>Luna</th><th class="r">Vânzări (fără TVA)</th><th class="r">Profit</th></tr></thead><tbody>${vanzari}</tbody></table>
    <h2>Profit pe client</h2>
    <table><thead><tr><th>Client</th><th class="r">Vânzări</th><th class="r">Profit</th></tr></thead><tbody>${
      clienti || '<tr><td colspan="3" class="muted">—</td></tr>'
    }</tbody></table>
    <h2>Achiziții pe furnizor</h2>
    <table><thead><tr><th>Furnizor</th><th class="r">Total</th></tr></thead><tbody>${
      furnizori || '<tr><td colspan="2" class="muted">—</td></tr>'
    }</tbody></table>
    <h2>De încasat</h2>
    <table><thead><tr><th>Comandă</th><th>Client</th><th class="r">Rest</th></tr></thead><tbody>${
      incasari || '<tr><td colspan="3" class="muted">Nimic de încasat</td></tr>'
    }</tbody></table>
  </body></html>`
}

// Randează HTML-ul într-o fereastră ascunsă și întoarce PDF-ul ca octeți.
async function randeazaPdf(html: string): Promise<Buffer> {
  const pdfWin = new BrowserWindow({ show: false })
  try {
    await pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    return await pdfWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
    })
  } finally {
    pdfWin.destroy()
  }
}

// Previzualizare: scriem PDF-ul într-un fișier temporar și îl deschidem în
// vizualizatorul PDF încorporat în Chromium — cu derulare, zoom, tipărire și
// salvare. Nimic nu ajunge în documentele utilizatorului până nu cere el.
export async function previzualizeazaPdf(
  parinte: BrowserWindow | undefined,
  html: string,
  titlu: string
): Promise<BackupResult> {
  try {
    const data = await randeazaPdf(html)
    // Numele fișierului temporar devine titlul din vizualizator, deci trebuie
    // să fie curat pe Windows (fără / \ : * ? " < > |).
    const cale = join(tmpdir(), `${numeFisierSigur(titlu, 'document')}.pdf`)
    writeFileSync(cale, data)

    const vizualizator = new BrowserWindow({
      width: 900,
      height: 1000,
      parent: parinte,
      title: titlu,
      autoHideMenuBar: true,
      backgroundColor: '#525659',
      webPreferences: { plugins: true, sandbox: false }
    })
    // Fereastra de previzualizare nu rulează cod din aplicație — orice legătură
    // din document se deschide în browserul implicit, nu aici.
    vizualizator.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })
    vizualizator.on('closed', () => {
      try {
        rmSync(cale, { force: true })
      } catch {
        /* fișier temporar — dacă Windows îl mai ține deschis, îl curăță sistemul */
      }
    })
    await vizualizator.loadURL(pathToFileURL(cale).toString())
    return { ok: true, cale }
  } catch (err) {
    return { ok: false, mesaj: (err as Error).message }
  }
}

async function htmlToPdf(
  win: BrowserWindow | undefined,
  html: string,
  defaultName: string
): Promise<BackupResult> {
  try {
    const data = await randeazaPdf(html)
    const res = await dialog.showSaveDialog(win!, {
      // Numerele de comandă românești conțin des „/” („F 145/2026”), pe care
      // Windows îl citește ca separator de folder.
      defaultPath: `${numeFisierSigur(defaultName, 'document')}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (res.canceled || !res.filePath) return { ok: false, mesaj: 'Export anulat.' }
    writeFileSync(res.filePath, data)
    const eroareDeschidere = await shell.openPath(res.filePath)
    if (eroareDeschidere) {
      jurnal.warn(`PDF salvat, dar nu s-a putut deschide: ${eroareDeschidere}`)
    }
    return { ok: true, cale: res.filePath }
  } catch (err) {
    return { ok: false, mesaj: (err as Error).message }
  }
}

// Documentele se construiesc o singură dată; previzualizarea și salvarea
// pornesc amândouă de la exact același HTML.
function htmlComanda(id: number): { html: string; nume: string } | null {
  const c = getComanda(id)
  if (!c) return null
  const client = c.client_id != null ? (getClient(c.client_id) ?? null) : null
  return {
    html: comandaHtml(getSetari(), c, client),
    nume: `${c.stare === 'oferta' ? 'Oferta' : 'Comanda'}-${c.numar ?? c.id}`
  }
}

export async function generatePdfComanda(
  win: BrowserWindow | undefined,
  id: number
): Promise<BackupResult> {
  const doc = htmlComanda(id)
  if (!doc) return { ok: false, mesaj: 'Comanda nu există.' }
  return htmlToPdf(win, doc.html, doc.nume)
}

export async function previzualizeazaPdfComanda(
  win: BrowserWindow | undefined,
  id: number
): Promise<BackupResult> {
  const doc = htmlComanda(id)
  if (!doc) return { ok: false, mesaj: 'Comanda nu există.' }
  return previzualizeazaPdf(win, doc.html, doc.nume)
}

export async function generatePdfRaport(
  win: BrowserWindow | undefined,
  an: number
): Promise<BackupResult> {
  return htmlToPdf(win, raportHtml(an), `Raport-${an}`)
}

export async function previzualizeazaPdfRaport(
  win: BrowserWindow | undefined,
  an: number
): Promise<BackupResult> {
  return previzualizeazaPdf(win, raportHtml(an), `Raport-${an}`)
}
