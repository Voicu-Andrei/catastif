import { contextBridge, ipcRenderer } from 'electron'
import type { CatastifApi, InfoActualizare } from '@shared/types'

const api: CatastifApi = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  },
  setari: {
    get: () => ipcRenderer.invoke('setari:get'),
    save: (patch) => ipcRenderer.invoke('setari:save', patch)
  },
  backup: {
    exportNow: () => ipcRenderer.invoke('backup:exportNow'),
    importFrom: () => ipcRenderer.invoke('backup:importFrom'),
    chooseFolder: () => ipcRenderer.invoke('backup:chooseFolder'),
    openFolder: () => ipcRenderer.invoke('backup:openFolder')
  },
  furnizori: {
    list: () => ipcRenderer.invoke('furnizori:list'),
    get: (id) => ipcRenderer.invoke('furnizori:get', id),
    create: (input) => ipcRenderer.invoke('furnizori:create', input),
    update: (id, input) => ipcRenderer.invoke('furnizori:update', id, input),
    delete: (id) => ipcRenderer.invoke('furnizori:delete', id)
  },
  clienti: {
    list: () => ipcRenderer.invoke('clienti:list'),
    get: (id) => ipcRenderer.invoke('clienti:get', id),
    create: (input) => ipcRenderer.invoke('clienti:create', input),
    update: (id, input) => ipcRenderer.invoke('clienti:update', id, input),
    delete: (id) => ipcRenderer.invoke('clienti:delete', id)
  },
  produse: {
    list: () => ipcRenderer.invoke('produse:list'),
    get: (id) => ipcRenderer.invoke('produse:get', id),
    create: (input) => ipcRenderer.invoke('produse:create', input),
    update: (id, input) => ipcRenderer.invoke('produse:update', id, input),
    delete: (id) => ipcRenderer.invoke('produse:delete', id)
  },
  comenzi: {
    list: (stare) => ipcRenderer.invoke('comenzi:list', stare),
    get: (id) => ipcRenderer.invoke('comenzi:get', id),
    create: (input) => ipcRenderer.invoke('comenzi:create', input),
    update: (id, input) => ipcRenderer.invoke('comenzi:update', id, input),
    accepta: (id) => ipcRenderer.invoke('comenzi:accepta', id),
    anuleaza: (id) => ipcRenderer.invoke('comenzi:anuleaza', id),
    plata: (id, suma) => ipcRenderer.invoke('comenzi:plata', id, suma),
    delete: (id) => ipcRenderer.invoke('comenzi:delete', id)
  },
  achizitii: {
    list: () => ipcRenderer.invoke('achizitii:list'),
    get: (id) => ipcRenderer.invoke('achizitii:get', id),
    create: (input) => ipcRenderer.invoke('achizitii:create', input),
    update: (id, input) => ipcRenderer.invoke('achizitii:update', id, input),
    delete: (id) => ipcRenderer.invoke('achizitii:delete', id)
  },
  dashboard: {
    get: () => ipcRenderer.invoke('dashboard:get')
  },
  search: {
    global: (q) => ipcRenderer.invoke('search:global', q)
  },
  fisiere: {
    list: (tip, id) => ipcRenderer.invoke('fisiere:list', tip, id),
    attach: (tip, id) => ipcRenderer.invoke('fisiere:attach', tip, id),
    open: (id) => ipcRenderer.invoke('fisiere:open', id),
    delete: (id) => ipcRenderer.invoke('fisiere:delete', id)
  },
  rapoarte: {
    get: (an) => ipcRenderer.invoke('rapoarte:get', an)
  },
  export: {
    tabel: (format, numeFisier, headers, rows) =>
      ipcRenderer.invoke('export:tabel', format, numeFisier, headers, rows)
  },
  pdf: {
    comanda: (id) => ipcRenderer.invoke('pdf:comanda', id),
    raport: (an) => ipcRenderer.invoke('pdf:raport', an)
  },
  update: {
    state: () => ipcRenderer.invoke('update:getStare'),
    onState: (cb) => {
      const listener = (_e: unknown, info: InfoActualizare): void => cb(info)
      ipcRenderer.on('update:stare', listener)
      return () => ipcRenderer.removeListener('update:stare', listener)
    },
    check: () => ipcRenderer.invoke('update:check'),
    respond: (raspuns) => ipcRenderer.invoke('update:response', raspuns),
    install: (cand) => ipcRenderer.invoke('update:install', cand),
    clearSkipped: () => ipcRenderer.invoke('update:clearSkipped')
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // Fallback (nu ar trebui folosit — contextIsolation e activ).
  // @ts-expect-error expunere directă pe window
  window.api = api
}
