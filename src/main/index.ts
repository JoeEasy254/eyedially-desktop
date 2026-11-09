import { app, BrowserWindow, ipcMain, Menu, screen } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ProjectStore } from './projects'
import { installAppProtocol, registerAppScheme } from './protocol'
import { registerIpc } from './ipc'
import { buildMenu } from './menu'

registerAppScheme()

const isDev = !app.isPackaged
const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let store: ProjectStore | null = null
let allowClose = false
let closeTimeout: NodeJS.Timeout | null = null

interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  maximized?: boolean
}

function windowStatePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

function loadWindowState(): WindowState {
  const fallback: WindowState = { width: 1320, height: 860 }
  try {
    const raw = JSON.parse(readFileSync(windowStatePath(), 'utf8')) as Partial<WindowState>
    const width = Math.max(900, Math.min(4000, Number(raw.width) || fallback.width))
    const height = Math.max(620, Math.min(3000, Number(raw.height) || fallback.height))
    return {
      width,
      height,
      x: typeof raw.x === 'number' ? raw.x : undefined,
      y: typeof raw.y === 'number' ? raw.y : undefined,
      maximized: raw.maximized === true,
    }
  } catch {
    return fallback
  }
}

function saveWindowState(win: BrowserWindow): void {
  try {
    const bounds = win.getNormalBounds()
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      maximized: win.isMaximized(),
    }
    writeFileSync(windowStatePath(), JSON.stringify(state))
  } catch {
    // Window state is best effort.
  }
}

function createWindow(): void {
  const saved = loadWindowState()
  const visibleOnScreen =
    saved.x !== undefined &&
    saved.y !== undefined &&
    screen.getAllDisplays().some((display) => {
      const area = display.workArea
      return (
        saved.x! >= area.x - 100 &&
        saved.y! >= area.y - 100 &&
        saved.x! < area.x + area.width &&
        saved.y! < area.y + area.height
      )
    })

  mainWindow = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    x: visibleOnScreen ? saved.x : undefined,
    y: visibleOnScreen ? saved.y : undefined,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: '#17100d',
    title: 'Angaza Sandbox',
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  })

  if (saved.maximized) mainWindow.maximize()

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('https://')) {
      void import('electron').then(({ shell }) => shell.openExternal(details.url))
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL() ?? ''
    if (url !== current) event.preventDefault()
  })

  mainWindow.on('close', (event) => {
    if (allowClose || !mainWindow || mainWindow.webContents.isDestroyed()) return
    event.preventDefault()
    mainWindow.webContents.send('app:request-close')
    if (closeTimeout) clearTimeout(closeTimeout)
    closeTimeout = setTimeout(() => {
      allowClose = true
      mainWindow?.close()
    }, 4000)
  })

  mainWindow.on('closed', () => {
    if (mainWindow) saveWindowState(mainWindow)
    if (closeTimeout) clearTimeout(closeTimeout)
    closeTimeout = null
    mainWindow = null
  })

  ipcMain.on('app:close-ready', () => {
    if (closeTimeout) clearTimeout(closeTimeout)
    closeTimeout = null
    allowClose = true
    mainWindow?.close()
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    installAppProtocol(join(__dirname, '../renderer'))
    void mainWindow.loadURL('app://bundle/index.html')
  }
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)

  const projectsRoot = join(app.getPath('userData'), 'projects')
  await mkdir(projectsRoot, { recursive: true })
  store = new ProjectStore(projectsRoot)

  registerIpc(store, () => mainWindow)
  buildMenu(() => mainWindow, projectsRoot, isDev)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  allowClose = true
})

if (!existsSync(app.getPath('userData'))) {
  void mkdir(app.getPath('userData'), { recursive: true })
}
