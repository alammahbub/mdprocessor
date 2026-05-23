import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // If Vite Dev Server is running, load the dev server URL
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Set up spellcheck language standard OS Native spelling
  const session = mainWindow.webContents.session
  session.setSpellCheckerLanguages(['en-US'])

  // Handle native spelling suggestions and context menus
  mainWindow.webContents.on('context-menu', (_event, params) => {
    if (params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
      mainWindow?.webContents.send('show-spelling-suggestions', {
        suggestions: params.dictionarySuggestions,
        misspelledWord: params.misspelledWord,
        x: params.x,
        y: params.y,
      })
    }
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC HANDLERS FOR SECURE FILE SYSTEM OPERATIONS

// Open File Dialog & Read file
ipcMain.handle('file:open', async () => {
  if (!mainWindow) return null

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Markdown File',
    filters: [{ name: 'Markdown Files', extensions: ['md', 'markdown'] }],
    properties: ['openFile'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const filePath = result.filePaths[0]
  const content = await fs.promises.readFile(filePath, 'utf-8')

  return { filePath, content }
})

// Save File
ipcMain.handle('file:save', async (_event, { filePath, content }) => {
  if (!filePath) {
    // If no filePath exists, trigger Save As dialog
    if (!mainWindow) return null

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Markdown File',
      filters: [{ name: 'Markdown Files', extensions: ['md', 'markdown'] }],
      defaultPath: 'Untitled.md',
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    filePath = result.filePath
  }

  // Create auto-recovery directory locks if not existing
  await fs.promises.writeFile(filePath, content, 'utf-8')
  return { filePath, success: true }
})

// Auto-Save Background Snapshots
ipcMain.handle('file:autosave', async (_event, { content, fileName }) => {
  try {
    const autosaveDir = path.join(app.getPath('userData'), 'autosave')
    if (!fs.existsSync(autosaveDir)) {
      await fs.promises.mkdir(autosaveDir, { recursive: true })
    }
    const autosavePath = path.join(autosaveDir, `${fileName || 'temp'}.recovery.md`)
    await fs.promises.writeFile(autosavePath, content, 'utf-8')
    return { success: true }
  } catch (error) {
    console.error('Autosave failed:', error)
    return { success: false }
  }
})

// Check Auto-Save Recovery
ipcMain.handle('file:check-recovery', async (_event, { fileName }) => {
  try {
    const autosavePath = path.join(app.getPath('userData'), 'autosave', `${fileName || 'temp'}.recovery.md`)
    if (fs.existsSync(autosavePath)) {
      const content = await fs.promises.readFile(autosavePath, 'utf-8')
      return { hasRecovery: true, content, path: autosavePath }
    }
    return { hasRecovery: false }
  } catch {
    return { hasRecovery: false }
  }
})

// Clear Auto-Save Recovery
ipcMain.handle('file:clear-recovery', async (_event, { fileName }) => {
  try {
    const autosavePath = path.join(app.getPath('userData'), 'autosave', `${fileName || 'temp'}.recovery.md`)
    if (fs.existsSync(autosavePath)) {
      await fs.promises.unlink(autosavePath)
    }
    return { success: true }
  } catch {
    return { success: false }
  }
})

// Save PDF Native Exporter
ipcMain.handle('file:export-pdf', async (_event, { htmlContent }) => {
  if (!mainWindow) return { success: false }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export to PDF',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    defaultPath: 'Document.pdf',
  })

  if (result.canceled || !result.filePath) {
    return { success: false }
  }

  // Create temporary hidden print window
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  const tempHtmlPath = path.join(app.getPath('temp'), 'novawriter-print.html')
  await fs.promises.writeFile(tempHtmlPath, htmlContent, 'utf-8')
  
  await printWindow.loadFile(tempHtmlPath)
  
  try {
    const pdfData = await printWindow.webContents.printToPDF({
      margins: { marginType: 'default' },
      pageSize: 'A4',
      printBackground: true,
    })
    
    await fs.promises.writeFile(result.filePath, pdfData)
    printWindow.close()
    await fs.promises.unlink(tempHtmlPath)
    return { success: true, filePath: result.filePath }
  } catch (error) {
    console.error('PDF export failed:', error)
    printWindow.close()
    return { success: false }
  }
})
