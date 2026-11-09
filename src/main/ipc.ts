import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import type { CreateProjectInput, DesktopProject } from '@shared/types'
import type { ProjectStore } from './projects'

const PNG_PREFIX = 'data:image/png;base64,'

function safeBaseName(name: string, fallback: string): string {
  const cleaned = basename(name)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .trim()
  return cleaned || fallback
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function registerIpc(store: ProjectStore, getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:open-projects-folder', async () => {
    const failure = await shell.openPath(store.getRoot())
    if (failure) throw new Error(failure)
  })

  ipcMain.handle('projects:list', () => store.list())
  ipcMain.handle('projects:load', (_event, id: string) => store.load(String(id)))
  ipcMain.handle('projects:create', (_event, input: CreateProjectInput) => store.create(input))
  ipcMain.handle('projects:save', (_event, project: DesktopProject) => store.save(project))
  ipcMain.handle('projects:remove', (_event, id: string) => store.delete(String(id)))
  ipcMain.handle('projects:duplicate', (_event, id: string) => store.duplicate(String(id)))
  ipcMain.handle('projects:rename', (_event, id: string, name: string) => store.rename(String(id), String(name)))

  ipcMain.handle('projects:import', async () => {
    const win = getWindow()
    const options: Electron.OpenDialogOptions = {
      title: 'Import project',
      properties: ['openFile'],
      filters: [
        { name: 'Angaza project', extensions: ['json', 'angaza'] },
        { name: 'All files', extensions: ['*'] },
      ],
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return store.importFile(result.filePaths[0])
  })

  ipcMain.handle('projects:export', async (_event, project: DesktopProject) => {
    const win = getWindow()
    const options: Electron.SaveDialogOptions = {
      title: 'Export project',
      defaultPath: `${safeBaseName(project.name, 'project')}.angaza.json`,
      filters: [{ name: 'Angaza project', extensions: ['json'] }],
    }
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return false
    await store.exportTo(result.filePath, project)
    return true
  })

  ipcMain.handle('screenshots:save', async (_event, dataUrl: string, suggestedName: string) => {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PNG_PREFIX)) {
      throw new Error('Invalid screenshot data.')
    }
    const win = getWindow()
    const options: Electron.SaveDialogOptions = {
      title: 'Save screenshot',
      defaultPath: `${safeBaseName(suggestedName, 'simulation')}.png`,
      filters: [{ name: 'PNG image', extensions: ['png'] }],
    }
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return false
    const data = Buffer.from(dataUrl.slice(PNG_PREFIX.length), 'base64')
    await writeFile(result.filePath, data)
    return true
  })

  ipcMain.on('app:set-title', (_event, title: string) => {
    getWindow()?.setTitle(String(title).slice(0, 200))
  })

  ipcMain.on('app:report-error', (_event, message: string) => {
    const win = getWindow()
    dialog.showErrorBox('Angaza Sandbox', String(message || errorMessage(message)))
    void win
  })
}
