import { app, BrowserWindow, dialog, Menu, shell } from 'electron'
import type { MenuAction } from '@shared/types'

export function buildMenu(getWindow: () => BrowserWindow | null, projectsRoot: string, isDev: boolean): void {
  const send = (action: MenuAction) => {
    getWindow()?.webContents.send('app:menu-action', action)
  }

  const template: Electron.MenuItemConstructorOptions[] = []

  if (process.platform === 'darwin') {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    })
  }

  template.push({
    label: 'File',
    submenu: [
      { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: () => send('new-project') },
      { label: 'Open Project Library', accelerator: 'CmdOrCtrl+O', click: () => send('open-library') },
      { type: 'separator' },
      { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
      { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('save-as') },
      { type: 'separator' },
      { label: 'Import Project…', click: () => send('import-project') },
      { label: 'Export Project…', click: () => send('export-project') },
      { type: 'separator' },
      { label: 'Open Projects Folder', click: () => void shell.openPath(projectsRoot) },
      { type: 'separator' },
      process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
    ],
  })

  template.push({
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
      { type: 'separator' },
      { label: 'Search Files', accelerator: 'CmdOrCtrl+Shift+F', click: () => send('search') },
    ],
  })

  template.push({
    label: 'View',
    submenu: [
      { label: 'Split View', accelerator: 'CmdOrCtrl+1', click: () => send('view-split') },
      { label: 'Editor Only', accelerator: 'CmdOrCtrl+2', click: () => send('view-editor') },
      { label: 'Preview Only', accelerator: 'CmdOrCtrl+3', click: () => send('view-preview') },
      { type: 'separator' },
      { label: 'Toggle Explorer', accelerator: 'CmdOrCtrl+B', click: () => send('toggle-explorer') },
      { label: 'Toggle Theme', accelerator: 'CmdOrCtrl+Shift+T', click: () => send('toggle-theme') },
      { type: 'separator' },
      { role: 'togglefullscreen' },
      ...(isDev ? [{ type: 'separator' as const }, { role: 'toggleDevTools' as const }] : []),
    ],
  })

  template.push({
    label: 'Simulation',
    submenu: [
      { label: 'Play / Pause', accelerator: 'F5', click: () => send('toggle-play') },
      { label: 'Step Frame', accelerator: 'F6', click: () => send('step') },
      { label: 'Restart', accelerator: 'F7', click: () => send('restart') },
      { label: 'Cycle Speed', accelerator: 'F8', click: () => send('cycle-speed') },
    ],
  })

  template.push({
    label: 'Help',
    submenu: [
      {
        label: 'About Angaza Sandbox',
        click: () => {
          const win = getWindow()
          if (!win) return
          void dialog.showMessageBox(win, {
            type: 'info',
            title: 'About Angaza Sandbox',
            message: `Angaza Sandbox ${app.getVersion()}`,
            detail:
              'A local-first sandbox for particle simulations. Write JavaScript, watch it move, and keep every project on your machine.',
            buttons: ['Close'],
          })
        },
      },
    ],
  })

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
