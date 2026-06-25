import { contextBridge, ipcRenderer } from 'electron'
import type { CatastifApi } from '@shared/types'

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
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // Fallback (nu ar trebui folosit — contextIsolation e activ).
  // @ts-ignore expunere directă pe window
  window.api = api
}
