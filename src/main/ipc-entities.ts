import { ipcMain } from 'electron'
import type { ClientInput, FurnizorInput, ProdusInput } from '@shared/types'
import {
  listFurnizori,
  getFurnizor,
  createFurnizor,
  updateFurnizor,
  deleteFurnizor
} from './db/repos/furnizori'
import {
  listClienti,
  getClient,
  createClient,
  updateClient,
  deleteClient
} from './db/repos/clienti'
import {
  listProduse,
  getProdus,
  createProdus,
  updateProdus,
  deleteProdus
} from './db/repos/produse'

export function registerEntitiesIpc(): void {
  // --- Furnizori ---
  ipcMain.handle('furnizori:list', () => listFurnizori())
  ipcMain.handle('furnizori:get', (_e, id: number) => getFurnizor(id))
  ipcMain.handle('furnizori:create', (_e, input: FurnizorInput) => createFurnizor(input))
  ipcMain.handle('furnizori:update', (_e, id: number, input: FurnizorInput) =>
    updateFurnizor(id, input)
  )
  ipcMain.handle('furnizori:delete', (_e, id: number) => deleteFurnizor(id))

  // --- Clienți ---
  ipcMain.handle('clienti:list', () => listClienti())
  ipcMain.handle('clienti:get', (_e, id: number) => getClient(id))
  ipcMain.handle('clienti:create', (_e, input: ClientInput) => createClient(input))
  ipcMain.handle('clienti:update', (_e, id: number, input: ClientInput) => updateClient(id, input))
  ipcMain.handle('clienti:delete', (_e, id: number) => deleteClient(id))

  // --- Produse ---
  ipcMain.handle('produse:list', () => listProduse())
  ipcMain.handle('produse:get', (_e, id: number) => getProdus(id))
  ipcMain.handle('produse:create', (_e, input: ProdusInput) => createProdus(input))
  ipcMain.handle('produse:update', (_e, id: number, input: ProdusInput) => updateProdus(id, input))
  ipcMain.handle('produse:delete', (_e, id: number) => deleteProdus(id))
}
