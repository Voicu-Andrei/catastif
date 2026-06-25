import { dialog, type BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'
import ExcelJS from 'exceljs'
import type { BackupResult, ExportFormat } from '@shared/types'

function csvCell(v: string | number): string {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
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
    defaultPath: `${numeFisier}.${ext}`,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
  })
  if (res.canceled || !res.filePath) return { ok: false, mesaj: 'Export anulat.' }

  try {
    if (format === 'csv') {
      const content = [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
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
