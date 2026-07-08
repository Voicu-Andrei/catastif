import { ipcMain } from 'electron'
import type {
  AchizitieInput,
  ClientInput,
  ComandaInput,
  FurnizorInput,
  ProdusInput,
  StareComanda
} from '@shared/types'
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
import {
  listComenzi,
  getComanda,
  createComanda,
  updateComanda,
  acceptaComanda,
  anuleazaComanda,
  inregistreazaPlata,
  deleteComanda
} from './db/repos/comenzi'
import {
  listAchizitii,
  getAchizitie,
  createAchizitie,
  updateAchizitie,
  deleteAchizitie
} from './db/repos/achizitii'

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

  // --- Comenzi ---
  ipcMain.handle('comenzi:list', (_e, stare?: StareComanda) => listComenzi(stare))
  ipcMain.handle('comenzi:get', (_e, id: number) => getComanda(id))
  ipcMain.handle('comenzi:create', (_e, input: ComandaInput) => createComanda(input))
  ipcMain.handle('comenzi:update', (_e, id: number, input: ComandaInput) =>
    updateComanda(id, input)
  )
  ipcMain.handle('comenzi:accepta', (_e, id: number) => acceptaComanda(id))
  ipcMain.handle('comenzi:anuleaza', (_e, id: number) => anuleazaComanda(id))
  ipcMain.handle('comenzi:plata', (_e, id: number, suma: number) => inregistreazaPlata(id, suma))
  ipcMain.handle('comenzi:delete', (_e, id: number) => deleteComanda(id))

  // --- Achiziții ---
  ipcMain.handle('achizitii:list', () => listAchizitii())
  ipcMain.handle('achizitii:get', (_e, id: number) => getAchizitie(id))
  ipcMain.handle('achizitii:create', (_e, input: AchizitieInput) => createAchizitie(input))
  ipcMain.handle('achizitii:update', (_e, id: number, input: AchizitieInput) =>
    updateAchizitie(id, input)
  )
  ipcMain.handle('achizitii:delete', (_e, id: number) => deleteAchizitie(id))
}
