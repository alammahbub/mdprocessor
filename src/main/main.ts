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
ipcMain.handle('file:export-pdf', async (_event, { htmlContent, filePath }) => {
  if (!mainWindow) return { success: false }

  // Derive default filename from the current .md file path
  const defaultName = filePath
    ? path.basename(filePath).replace(/\.md$/i, '') + '.pdf'
    : 'Document.pdf'

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export to PDF',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    defaultPath: defaultName,
  })

  if (result.canceled || !result.filePath) {
    return { success: false }
  }

  // Create temporary hidden print window
  const printWindow = new BrowserWindow({
    show: false,
    width: 794,   // A4 width at 96 DPI
    height: 1123, // A4 height at 96 DPI
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  const tempHtmlPath = path.join(app.getPath('temp'), 'supermd-print.html')
  await fs.promises.writeFile(tempHtmlPath, htmlContent, 'utf-8')
  
  await printWindow.loadFile(tempHtmlPath)
  
  // Wait for content (images, fonts, SVGs) to fully render
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  try {
    const pdfData = await printWindow.webContents.printToPDF({
      margins: {
        marginType: 'custom',
        top: 0.6,
        bottom: 0.6,
        left: 0.7,
        right: 0.7,
      },
      pageSize: 'A4',
      printBackground: true,
      displayHeaderFooter: false,
      preferCSSPageSize: true,
    })
    
    await fs.promises.writeFile(result.filePath, pdfData)
    printWindow.close()
    await fs.promises.unlink(tempHtmlPath).catch(() => {})
    return { success: true, filePath: result.filePath }
  } catch (error) {
    console.error('PDF export failed:', error)
    printWindow.close()
    return { success: false }
  }
})

// Save DOCX Native Exporter (Word-compatible HTML wrapped in MHTML)
ipcMain.handle('file:export-docx', async (_event, { htmlContent, filePath }) => {
  if (!mainWindow) return { success: false }

  // Derive default filename from the current .md file path
  const defaultName = filePath
    ? path.basename(filePath).replace(/\.md$/i, '') + '.docx'
    : 'Document.docx'

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export to Word Document',
    filters: [{ name: 'Word Documents', extensions: ['docx'] }],
    defaultPath: defaultName,
  })

  if (result.canceled || !result.filePath) {
    return { success: false }
  }

  try {
    // Wrap the HTML content in a Word-compatible HTML document
    // Microsoft Word natively opens HTML files with proper xmlns namespaces
    const wordHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: A4;
      margin: 2.54cm 2.54cm 2.54cm 2.54cm;
      mso-header-margin: 1.27cm;
      mso-footer-margin: 1.27cm;
      mso-page-orientation: portrait;
    }
    body {
      font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      color: #323130;
      line-height: 1.6;
      margin: 0;
      padding: 0;
    }
    h1 {
      font-size: 20pt;
      font-weight: bold;
      color: #2b579a;
      border-bottom: 1px solid #d2d0ce;
      padding-bottom: 4pt;
      margin-top: 18pt;
      margin-bottom: 6pt;
      page-break-after: avoid;
    }
    h2 {
      font-size: 16pt;
      font-weight: bold;
      color: #2b579a;
      margin-top: 16pt;
      margin-bottom: 4pt;
      page-break-after: avoid;
    }
    h3 {
      font-size: 13pt;
      font-weight: bold;
      color: #404040;
      margin-top: 12pt;
      margin-bottom: 4pt;
      page-break-after: avoid;
    }
    h4, h5, h6 {
      font-size: 11pt;
      font-weight: bold;
      color: #404040;
      margin-top: 10pt;
      margin-bottom: 3pt;
    }
    p {
      font-size: 11pt;
      margin-top: 0;
      margin-bottom: 8pt;
    }
    blockquote {
      border-left: 3pt solid #2b579a;
      padding-left: 10pt;
      margin-left: 0;
      margin-right: 0;
      margin-top: 8pt;
      margin-bottom: 8pt;
      font-style: italic;
      color: #605e5c;
    }
    pre, code {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 9.5pt;
    }
    pre {
      background-color: #f5f5f5;
      border: 1px solid #e1dfdd;
      border-radius: 4pt;
      padding: 10pt;
      margin: 8pt 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      page-break-inside: avoid;
    }
    code {
      background-color: #f0f0f0;
      padding: 1pt 3pt;
      border-radius: 2pt;
    }
    pre code {
      background: none;
      padding: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10pt 0;
      page-break-inside: avoid;
    }
    th, td {
      border: 1pt solid #c8c6c4;
      padding: 6pt 8pt;
      text-align: left;
      font-size: 10pt;
    }
    th {
      background-color: #f3f2f1;
      font-weight: bold;
      color: #323130;
    }
    ul, ol {
      margin-top: 4pt;
      margin-bottom: 8pt;
      padding-left: 24pt;
    }
    li {
      margin-bottom: 3pt;
    }
    a {
      color: #2b579a;
      text-decoration: underline;
    }
    hr {
      border: none;
      border-top: 1pt solid #d2d0ce;
      margin: 12pt 0;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    mark {
      background-color: #ffff00;
      padding: 0 2pt;
    }
    del, s {
      text-decoration: line-through;
      color: #a19f9d;
    }
    .supermd-code-block {
      background-color: #1e1e1e;
      color: #d4d4d4;
      padding: 10pt;
      border-radius: 4pt;
      font-family: 'Consolas', monospace;
      font-size: 9.5pt;
      white-space: pre-wrap;
      page-break-inside: avoid;
    }
    .mermaid-rendered-container, .mermaid-svg-frame {
      text-align: center;
      margin: 10pt 0;
      page-break-inside: avoid;
    }
    svg {
      max-width: 100%;
      height: auto;
    }
    sup { vertical-align: super; font-size: 8pt; }
    sub { vertical-align: sub; font-size: 8pt; }
    u { text-decoration: underline; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`

    await fs.promises.writeFile(result.filePath, wordHtml, 'utf-8')
    return { success: true, filePath: result.filePath }
  } catch (error) {
    console.error('DOCX export failed:', error)
    return { success: false }
  }
})
