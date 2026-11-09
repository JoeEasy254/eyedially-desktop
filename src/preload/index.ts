import { contextBridge, ipcRenderer } from 'electron'
import type { AngazaApi } from '@shared/api'
import type { CreateProjectInput, DesktopProject, ProjectSummary } from '@shared/types'

const api: AngazaApi = {
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('app:version'),
  projects: {
    list: () => ipcRenderer.invoke('projects:list') as Promise<ProjectSummary[]>,
    load: (id: string) => ipcRenderer.invoke('projects:load', id) as Promise<DesktopProject>,
    create: (input: CreateProjectInput) =>
      ipcRenderer.invoke('projects:create', input) as Promise<DesktopProject>,
    save: (project: DesktopProject) =>
      ipcRenderer.invoke('projects:save', project) as Promise<ProjectSummary>,
    remove: (id: string) => ipcRenderer.invoke('projects:remove', id) as Promise<void>,
    duplicate: (id: string) => ipcRenderer.invoke('projects:duplicate', id) as Promise<DesktopProject>,
    rename: (id: string, name: string) =>
      ipcRenderer.invoke('projects:rename', id, name) as Promise<ProjectSummary>,
    importProject: () => ipcRenderer.invoke('projects:import') as Promise<DesktopProject | null>,
    exportProject: (project: DesktopProject) =>
      ipcRenderer.invoke('projects:export', project) as Promise<boolean>,
  },
  screenshots: {
    save: (dataUrl: string, suggestedName: string) =>
      ipcRenderer.invoke('screenshots:save', dataUrl, suggestedName) as Promise<boolean>,
  },
  openProjectsFolder: () => ipcRenderer.invoke('app:open-projects-folder') as Promise<void>,
  setTitle: (title: string) => ipcRenderer.send('app:set-title', title),
  onMenuAction: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, action: Parameters<typeof callback>[0]) => callback(action)
    ipcRenderer.on('app:menu-action', listener)
    return () => ipcRenderer.removeListener('app:menu-action', listener)
  },
  onRequestClose: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('app:request-close', listener)
    return () => ipcRenderer.removeListener('app:request-close', listener)
  },
  confirmClose: () => ipcRenderer.send('app:close-ready'),
}

contextBridge.exposeInMainWorld('angaza', api)
