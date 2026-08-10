import { dialog, type BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'
import ExcelJS from 'exceljs'
import { numeFisierSigur } from './nume-fisier'
import type { BackupResult, ExportFormat } from '@shared/types'

// Excel pe Windows în limba română folosește „;” ca separator de listă și „,”
// ca separator zecimal. Un CSV cu virgulă și punct zecimal se deschide într-o
// singură coloană, iar sumele rămân text — deci SUM() dă zero. Scriem exact ce
// așteaptă Excel-ul de pe calculatorul utilizatorului.
const SEPARATOR = ';'

function csvCell(v: string | number): string {
  // Numerele merg cu virgulă zecimală, ca Excel să le vadă drept numere.
  const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '')
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function exportTabel(
  win: BrowserWindow | undefined,
  format: ExportFormat,
  numeFisier: string,
  headers: string[],
  rows: (string | number)[][]
): Promise<BackupResult> {
  const ext = format === 'xlsx' ? 'xlsx' : 'csv'
  const res = await dialog.showSaveDialog(win!, {
    defaultPath: `${numeFisierSigur(numeFisier, 'export')}.${ext}`,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
  })
  if (res.canceled || !res.filePath) return { ok: false, mesaj: 'Export anulat.' }

  try {
    if (format === 'csv') {
      const content = [headers, ...rows].map((r) => r.map(csvCell).join(SEPARATOR)).join('\r\n')
      // BOM (U+FEFF) ca Excel să afișeze corect diacriticele
      writeFileSync(res.filePath, '﻿' + content, 'utf8')
    } else {
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Raport')
      ws.addRow(headers)
      ws.getRow(1).font = { bold: true }
      rows.forEach((r) => ws.addRow(r))
      ws.columns.forEach((col) => {
        col.width = 22
      })
      await wb.xlsx.writeFile(res.filePath)
    }
    return { ok: true, cale: res.filePath }
  } catch (err) {
    return { ok: false, mesaj: (err as Error).message }
  }
}
