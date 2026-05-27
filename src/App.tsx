import { useState, useEffect, useCallback, useRef } from 'react'
import { RibbonToolbar } from './renderer/components/RibbonToolbar'
import { WordEditor } from './renderer/components/WordEditor'
import { MarkdownEditor } from './renderer/components/MarkdownEditor'
import './renderer/styles/app-layout.css'
import './renderer/styles/table-resizer.css'

declare global {
  interface Window {
    electronAPI: {
      openFile: () => Promise<{ filePath: string; content: string } | null>
      saveFile: (payload: { filePath: string | null; content: string }) => Promise<{ filePath: string; success: boolean } | null>
      autoSave: (payload: { content: string; fileName: string | null }) => Promise<{ success: boolean }>
      checkRecovery: (payload: { fileName: string | null }) => Promise<{ hasRecovery: boolean; content?: string }>
      clearRecovery: (payload: { fileName: string | null }) => Promise<{ success: boolean }>
      exportPDF: (payload: { htmlContent: string; filePath?: string | null }) => Promise<{ success: boolean; filePath?: string }>
      exportDOCX: (payload: { htmlContent: string; filePath?: string | null }) => Promise<{ success: boolean; filePath?: string }>
      onSpellingSuggestions?: (callback: (data: { suggestions: string[]; misspelledWord: string; x: number; y: number }) => void) => () => void
    }
  }
}

const DEFAULT_MARKDOWN = `# Welcome to SuperMD!

SuperMD is an enterprise-grade hybrid Markdown word processor that merges visual WYSIWYG editing with clean structural Markdown files.

## Text Formatting

**Bold**, *Italic*, ***Bold Italic***, ~~Strikethrough~~, <u>Underline</u>, <mark>Highlight</mark>, <ins>Inserted</ins>, and \`Inline Code\`.

## Links & References

Check out the [Markdown Reference](https://www.markdownlang.com) for more syntax tips.

Automatic links are also supported: <https://www.markdownlang.com> and <email@example.com>

## Math Formulas

SuperMD supports LaTeX math with KaTeX rendering. Both inline formulas like <span data-math-inline="E = mc^2"></span> and block formulas are fully supported.

Block formulas:

<div data-math-block="\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}"></div>

## Interactive Diagrams

Try editing the graph below by clicking on it:

\`\`\`mermaid
graph TD
  A[Start Coding] --> B(Scaffold Electron + React)
  B --> C{Bidirectional Sync}
  C -->|Yes| D[Wow User with High Fidelity]
  C -->|No| E[Cursor Jump Errors]
\`\`\`

## Tables Support

<table data-type="supermd-table" data-cols="[&quot;Processor Feature&quot;,&quot;Word WYSIWYG Mode&quot;,&quot;Markdown Editor Mode&quot;]" data-rows="[[&quot;Mermaid Graph Compiler&quot;,&quot;✅ Vector SVG Chart renders visually&quot;,&quot;💻 Raw structural node graphs&quot;],[&quot;Interactive Sizing Columns&quot;,&quot;✅ Click and drag cell boundaries&quot;,&quot;🛠️ Automated data attribute sync&quot;],[&quot;Dynamic Sync Verification&quot;,&quot;✅ High-contrast parity logs&quot;,&quot;🔄 Automatic AST synchronization&quot;]]" data-colwidths="[&quot;auto&quot;,&quot;auto&quot;,&quot;auto&quot;]" style="width: 100%; border-collapse: collapse;"></table>

## Task Lists

- [x] Implemented autolink support
- [x] Enabled typography extension
- [ ] Add more KaTeX formulas
- [ ] Write unit tests

## Extended Syntax

### Fenced Code Blocks

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}
greet("SuperMD");
\`\`\`

### Indented Code Block (4 spaces)

    This is an indented code block.
    It uses 4 spaces for indentation.

### Definition List

Using raw HTML for extended syntax support:

<dl>
  <dt>Markdown</dt>
  <dd>A lightweight markup language for formatting text.</dd>
  <dt>SuperMD</dt>
  <dd>An enterprise-grade hybrid word processor.</dd>
</dl>

### Footnotes

Here's a sentence with a footnote reference.<sup id="fnref-1"><a href="#fn-1">1</a></sup>

<ol>
  <li id="fn-1">This is the footnote content. <a href="#fnref-1">↩</a></li>
</ol>

### HTML Tags

<strong>Bold via HTML</strong>, <em>Italic via HTML</em>, <del>Deleted via HTML</del>, <ins>Inserted via HTML</ins>

---

Enjoy using SuperMD!
`

// Generate Table of Contents from markdown
function generateTOC(markdown: string): string {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  const headings: { level: number; text: string; anchor: string }[] = []
  let match

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length
    const text = match[2].trim()
    const anchor = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    headings.push({ level, text, anchor })
  }

  if (headings.length === 0) {
    return '*No headings found in document*'
  }

  let toc = '## Table of Contents\n\n'
  for (const h of headings) {
    const indent = '  '.repeat(h.level - 1)
    toc += `${indent}- [${h.text}](#${h.anchor})\n`
  }
  toc += '\n---\n'
  return toc
}

// Calculate reading time
function readingTime(text: string): string {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const minutes = Math.max(1, Math.ceil(words / 200))
  return `${minutes} min read`
}

// Recent files helpers
const RECENT_FILES_KEY = 'supermd-recent-files'

function loadRecentFiles(): { path: string; name: string; timestamp: number }[] {
  try {
    const data = localStorage.getItem(RECENT_FILES_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveRecentFiles(files: { path: string; name: string; timestamp: number }[]) {
  try {
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(files.slice(0, 10)))
  } catch {
    // localStorage might be full
  }
}

function addRecentFile(filePath: string) {
  const file = {
    path: filePath,
    name: filePath.split(/[\\/]/).pop() || 'Untitled',
    timestamp: Date.now(),
  }
  const recent = loadRecentFiles().filter((f) => f.path !== filePath)
  recent.unshift(file)
  saveRecentFiles(recent)
}

// Maps a ProseMirror content index to the corresponding character position in Markdown
function mapProseMirrorToMarkdown(editor: any, pos: number, markdownText: string): number {
  if (pos <= 0) return 0
  if (pos >= editor.state.doc.content.size) return markdownText.length

  const cleanText = editor.state.doc.textBetween(0, pos, '\n', '\n')
  
  let cleanIdx = 0
  let mdIdx = 0
  
  while (cleanIdx < cleanText.length && mdIdx < markdownText.length) {
    const cleanChar = cleanText[cleanIdx]
    const mdChar = markdownText[mdIdx]
    
    if (cleanChar === mdChar) {
      cleanIdx++
      mdIdx++
    } else {
      mdIdx++
    }
  }
  
  return mdIdx
}

// Maps a raw Markdown character index to the corresponding content position in ProseMirror (Tiptap)
function mapMarkdownToProseMirror(editor: any, mdPos: number, markdownText: string): number {
  if (mdPos <= 0) return 1
  const docSize = editor.state.doc.content.size
  if (mdPos >= markdownText.length) return docSize

  const mdText = markdownText.substring(0, mdPos)
  const fullCleanText = editor.state.doc.textBetween(0, docSize, '\n', '\n')
  
  let cleanIdx = 0
  let mdIdx = 0
  
  while (cleanIdx < fullCleanText.length && mdIdx < mdText.length) {
    const cleanChar = fullCleanText[cleanIdx]
    const mdChar = mdText[mdIdx]
    
    if (cleanChar === mdChar) {
      cleanIdx++
      mdIdx++
    } else {
      mdIdx++
    }
  }
  
  let low = 1
  let high = docSize
  let resolvedPos = 1
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const len = editor.state.doc.textBetween(0, mid, '\n', '\n').length
    
    if (len >= cleanIdx) {
      resolvedPos = mid
      high = mid - 1
    } else {
      low = mid + 1
    }
  }
  
  return resolvedPos
}

const DEFAULT_SHORTCUTS: Record<string, { key: string; ctrl: boolean; shift: boolean; alt: boolean; label: string; description: string }> = {
  bold: { key: 'b', ctrl: true, shift: false, alt: false, label: 'Bold', description: 'Toggle bold formatting' },
  italic: { key: 'i', ctrl: true, shift: false, alt: false, label: 'Italic', description: 'Toggle italic formatting' },
  underline: { key: 'u', ctrl: true, shift: false, alt: false, label: 'Underline', description: 'Toggle underline formatting' },
  strike: { key: 's', ctrl: true, shift: true, alt: false, label: 'Strikethrough', description: 'Toggle strikethrough' },
  save: { key: 's', ctrl: true, shift: false, alt: false, label: 'Save', description: 'Save current document' },
  open: { key: 'o', ctrl: true, shift: false, alt: false, label: 'Open', description: 'Open a document' },
  newFile: { key: 'n', ctrl: true, shift: false, alt: false, label: 'New Document', description: 'Create a new document' },
  undo: { key: 'z', ctrl: true, shift: false, alt: false, label: 'Undo', description: 'Undo last action' },
  redo: { key: 'y', ctrl: true, shift: false, alt: false, label: 'Redo', description: 'Redo last action' },
  cut: { key: 'x', ctrl: true, shift: false, alt: false, label: 'Cut', description: 'Cut selection to clipboard' },
  copy: { key: 'c', ctrl: true, shift: false, alt: false, label: 'Copy', description: 'Copy selection to clipboard' },
  paste: { key: 'v', ctrl: true, shift: false, alt: false, label: 'Paste', description: 'Paste selection from clipboard' },
  insertTable: { key: 't', ctrl: true, shift: false, alt: false, label: 'Insert Table', description: 'Insert a GFM table' },
  insertTaskList: { key: 't', ctrl: true, shift: true, alt: false, label: 'Insert Task List', description: 'Insert a task list' },
  insertLink: { key: 'l', ctrl: true, shift: false, alt: false, label: 'Insert Link', description: 'Insert a hyperlink' },
  insertMath: { key: 'k', ctrl: true, shift: false, alt: false, label: 'Insert Math', description: 'Insert a LaTeX formula' },
  insertMermaid: { key: 'm', ctrl: true, shift: false, alt: false, label: 'Insert Mermaid', description: 'Insert a Mermaid diagram' },
  exportPDF: { key: 'p', ctrl: true, shift: true, alt: false, label: 'Export PDF', description: 'Export document as PDF' },
  insertTOC: { key: 'h', ctrl: true, shift: true, alt: false, label: 'Insert TOC', description: 'Insert Table of Contents' },
}

function App() {
  // Application State
  const [markdown, setMarkdown] = useState<string>(DEFAULT_MARKDOWN)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('Home')
  const [marginType, setMarginType] = useState<'normal' | 'narrow' | 'wide'>('normal')
  const [viewMode, setViewMode] = useState<'word' | 'markdown' | 'split'>('word')
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string>('')
  const [showLineNumbers, setShowLineNumbers] = useState<boolean>(true)
  const [showInvisibles, setShowInvisibles] = useState<boolean>(false)
  const [selectionTick, setSelectionTick] = useState<number>(0)
  const [distractionFree, setDistractionFree] = useState<boolean>(false)
  const [theme, setTheme] = useState<string>('light')
  const [fileVersion, setFileVersion] = useState<number>(0)
  const [recentFiles, setRecentFiles] = useState<{ path: string; name: string; timestamp: number }[]>([])
  const [wordSelection, setWordSelection] = useState<{ anchor: number; head: number } | null>(null)
  const [codeSelection, setCodeSelection] = useState<{ anchor: number; head: number } | null>(null)
  const isSyncingSelectionRef = useRef(false)
  const triggerSelectionTick = () => setSelectionTick((t) => t + 1)

  // Keyboard shortcut configuration state
  const [shortcuts, setShortcuts] = useState<Record<string, { key: string; ctrl: boolean; shift: boolean; alt: boolean; label: string; description: string }>>(() => {
    try {
      const stored = localStorage.getItem('supermd-keyboard-shortcuts')
      return stored ? JSON.parse(stored) : DEFAULT_SHORTCUTS
    } catch {
      return DEFAULT_SHORTCUTS
    }
  })

  // Shortcuts modal and rebinding overlay states
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false)
  const [rebindingAction, setRebindingAction] = useState<string | null>(null)
  const [rebindingKeys, setRebindingKeys] = useState<{ key: string; ctrl: boolean; shift: boolean; alt: boolean } | null>(null)

  // Ref to store the absolute latest markdown content synchronously, avoiding cursor sync race conditions
  const latestMarkdownRef = useRef(markdown)
  useEffect(() => {
    latestMarkdownRef.current = markdown
  }, [markdown])

  const handleMarkdownChange = useCallback((newVal: string) => {
    latestMarkdownRef.current = newVal
    setMarkdown(newVal)
  }, [])

  // Editor instance state from WordEditor
  const [editorInstance, setEditorInstance] = useState<any>(null)

  // Interactive diagnostics states and console redirect hook
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [diagLogs, setDiagLogs] = useState<string[]>([])

  useEffect(() => {
    const originalLog = console.log
    const originalError = console.error
    
    console.log = (...args) => {
      originalLog(...args)
      const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
      setDiagLogs(prev => [...prev.slice(-99), `[LOG] ${msg}`])
    }
    
    console.error = (...args) => {
      originalError(...args)
      const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
      setDiagLogs(prev => [...prev.slice(-99), `[ERR] ${msg}`])
    }
    
    return () => {
      console.log = originalLog
      console.error = originalError
    }
  }, [])

  // Show status popup toast
  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }, [])

  // Stable callback for editor ready
  const handleEditorReady = useCallback((editor: any) => {
    setEditorInstance(editor)
  }, [])

  const handleWordSelectionChange = useCallback((anchor: number, head: number) => {
    triggerSelectionTick() // Update tick for ribbon formatting toolbar state sync

    if (isSyncingSelectionRef.current || viewMode !== 'split') return
    const editor = editorInstance
    if (!editor || editor.isDestroyed) return

    isSyncingSelectionRef.current = true
    try {
      const currentMarkdown = latestMarkdownRef.current
      const mdAnchor = mapProseMirrorToMarkdown(editor, anchor, currentMarkdown)
      const mdHead = mapProseMirrorToMarkdown(editor, head, currentMarkdown)
      setCodeSelection({ anchor: mdAnchor, head: mdHead })
    } catch (err) {
      console.warn('[Selection Sync] pm to md error:', err)
    } finally {
      isSyncingSelectionRef.current = false
    }
  }, [editorInstance, viewMode])

  const handleCodeSelectionChange = useCallback((anchor: number, head: number) => {
    if (isSyncingSelectionRef.current || viewMode !== 'split') return
    const editor = editorInstance
    if (!editor || editor.isDestroyed) return

    isSyncingSelectionRef.current = true
    try {
      const currentMarkdown = latestMarkdownRef.current
      const pmAnchor = mapMarkdownToProseMirror(editor, anchor, currentMarkdown)
      const pmHead = mapMarkdownToProseMirror(editor, head, currentMarkdown)
      setWordSelection({ anchor: pmAnchor, head: pmHead })
    } catch (err) {
      console.warn('[Selection Sync] md to pm error:', err)
    } finally {
      isSyncingSelectionRef.current = false
    }
  }, [editorInstance, viewMode])

  // Collapsible Activity History sidebar states and callback
  interface ActivityItem {
    id: string
    timestamp: string
    action: string
    icon: string
    status: 'success' | 'warning' | 'error' | 'sync'
    details?: string
  }

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activities, setActivities] = useState<ActivityItem[]>([
    {
      id: 'init',
      timestamp: new Date().toLocaleTimeString(),
      action: 'SuperMD initialized',
      icon: '🚀',
      status: 'success',
      details: 'Editor workspace loaded successfully.'
    }
  ])

  const logActivity = useCallback((action: string, icon: string, status: 'success' | 'warning' | 'error' | 'sync' = 'success', details?: string) => {
    const newActivity: ActivityItem = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      action,
      icon,
      status,
      details
    }
    setActivities(prev => [newActivity, ...prev.slice(0, 49)])
  }, [])

  // Expose logActivity globally on window for custom node views to use
  useEffect(() => {
    (window as any).logActivity = logActivity
    return () => {
      delete (window as any).logActivity
    }
  }, [logActivity])

  // Global customizable keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If we are actively rebinding a shortcut in the rebinding overlay modal, let it capture
      if (rebindingAction) {
        if (e.key === 'Escape') {
          setRebindingAction(null)
          setRebindingKeys(null)
          e.preventDefault()
          e.stopPropagation()
        }
        return
      }

      // If any modal/overlay is open or if user is focusing an input, let standard keydown behave normally
      let editorViewFocused = false
      try {
        editorViewFocused = !!(editorInstance && !editorInstance.isDestroyed && editorInstance.view?.focused)
      } catch {
        // Editor view may be unavailable during remount — treat as unfocused
      }
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement?.hasAttribute('contenteditable') && !editorViewFocused)
      ) {
        return
      }

      // Find matching shortcut
      const match = Object.entries(shortcuts).find(([_, config]: [string, any]) => {
        const keyMatch = e.key.toLowerCase() === config.key.toLowerCase()
        const ctrlMatch = config.ctrl === (e.ctrlKey || e.metaKey)
        const shiftMatch = config.shift === e.shiftKey
        const altMatch = config.alt === e.altKey
        return keyMatch && ctrlMatch && shiftMatch && altMatch
      })

      if (match) {
        const [actionName] = match
        e.preventDefault()
        e.stopPropagation()

        // Trigger corresponding action
        switch (actionName) {
          case 'bold':
            runCommand((editor) => editor.chain().focus().toggleBold().run(), 'Toggled Bold Formatting', '🅱️')
            break
          case 'italic':
            runCommand((editor) => editor.chain().focus().toggleItalic().run(), 'Toggled Italic Formatting', '🇮')
            break
          case 'underline':
            runCommand((editor) => editor.chain().focus().toggleUnderline().run(), 'Toggled Underline Formatting', '🇺')
            break
          case 'strike':
            runCommand((editor) => editor.chain().focus().toggleStrike().run(), 'Toggled Strikethrough', '🇸')
            break
          case 'save':
            handleSaveFile()
            break
          case 'open':
            handleOpenFile()
            break
          case 'newFile':
            handleNewFile()
            break
          case 'undo':
            runCommand((editor) => editor.chain().focus().undo().run(), 'Undo Last Action', '↶')
            break
          case 'redo':
            runCommand((editor) => editor.chain().focus().redo().run(), 'Redo Last Action', '↷')
            break
          case 'cut':
            document.execCommand('cut')
            triggerToast('Cut')
            logActivity('Cut Content', '✂️', 'success')
            break
          case 'copy':
            document.execCommand('copy')
            triggerToast('Copied to Clipboard')
            logActivity('Copied Content', '📋', 'success')
            break
          case 'paste':
            navigator.clipboard.readText().then((text) => {
              if (text) {
                runCommand((editor) => editor.chain().focus().insertContent(text).run(), 'Pasted Clipboard Content', '📋')
              }
            })
            break
          case 'insertTable':
            runCommand((editor) =>
              editor.chain()
                .focus()
                .insertContent({
                  type: 'supermdTable',
                  attrs: {
                    cols: ['Header 1', 'Header 2'],
                    rows: [['Cell A', 'Cell B'], ['Cell C', 'Cell D']],
                  },
                })
                .run()
            , 'Inserted Data Table', '📅')
            break
          case 'insertTaskList':
            runCommand((editor) =>
              editor.chain()
                .focus()
                .insertContent({
                  type: 'taskList',
                  content: [
                    {
                      type: 'taskItem',
                      attrs: { checked: false },
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New task' }] }],
                    },
                  ],
                })
                .run()
            , 'Inserted Task List', '☑')
            break
          case 'insertLink':
            const url = prompt('Enter URL:')
            if (url) {
              runCommand((editor) => editor.chain().focus().setLink({ href: url }).run(), 'Inserted Link', '🔗')
            }
            break
          case 'insertMath':
            const latex = prompt('Enter LaTeX formula:', 'E = mc^2')
            if (latex) {
              runCommand((editor) =>
                editor.chain()
                  .focus()
                  .insertContent({
                    type: 'mathBlock',
                    attrs: { latex },
                  })
                  .run()
              , 'Inserted Math Formula', '∑')
            }
            break
          case 'insertMermaid':
            runCommand((editor) =>
              editor.chain()
                .focus()
                .insertContent({
                  type: 'mermaidCode',
                  attrs: { code: 'graph TD\n  A[Start] --> B(Edit Code)' },
                })
                .run()
            , 'Inserted Mermaid Diagram', '📊')
            break
          case 'exportPDF':
            handleExportPDF()
            break
          case 'insertTOC':
            handleInsertTOC()
            break
          default:
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [shortcuts, editorInstance, markdown, viewMode, rebindingAction])

  // Rebinding shortcut keypress capture effect
  useEffect(() => {
    if (!rebindingAction) return

    const captureKeys = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const key = e.key.toLowerCase()

      // Ignore bare modifiers like Control, Shift, Alt, Meta
      if (['control', 'shift', 'alt', 'meta'].includes(key)) {
        return
      }

      // Cancel capture if they press Esc
      if (e.key === 'Escape') {
        setRebindingAction(null)
        setRebindingKeys(null)
        return
      }

      setRebindingKeys({
        key: e.key.toLowerCase(),
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey
      })
    }

    window.addEventListener('keydown', captureKeys, true)
    return () => {
      window.removeEventListener('keydown', captureKeys, true)
    }
  }, [rebindingAction])

  // Load recent files on mount
  useEffect(() => {
    setRecentFiles(loadRecentFiles())
  }, [])

  // File Operations IPC Calls
  const handleNewFile = () => {
    const confirmNew = window.confirm('Are you sure you want to create a new document? Any unsaved changes will be lost.')
    if (confirmNew) {
      setMarkdown(DEFAULT_MARKDOWN)
      setFilePath(null)
      setFileVersion(v => v + 1)
      triggerToast('New Document Created')
      logActivity('Created New Document', '📄', 'success', 'Editor canvas reset to default state.')
    }
  }

  const handleOpenFile = async () => {
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.openFile()
        if (res) {
          setMarkdown(res.content)
          setFilePath(res.filePath)
          setFileVersion(v => v + 1)
          addRecentFile(res.filePath)
          setRecentFiles(loadRecentFiles())
          triggerToast('File loaded successfully!')
          logActivity('Loaded Document File', '📂', 'success', `File path: ${res.filePath}`)
        }
      } else {
        // Web mock: prompt for file path
        const mockPath = prompt('Enter file path to open:')
        if (mockPath) {
          setFilePath(mockPath)
          setFileVersion(v => v + 1)
          addRecentFile(mockPath)
          setRecentFiles(loadRecentFiles())
          triggerToast('Desktop API not found (mock open)')
          logActivity('Loaded Mock Document', '📂', 'warning', `Mock path: ${mockPath}`)
        }
      }
    } catch (err: any) {
      console.error(err)
      triggerToast('Error loading file.')
      logActivity('Failed to Open File', '📂', 'error', err?.message || String(err))
    }
  }

  const handleSaveFile = async () => {
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.saveFile({ filePath, content: markdown })
        if (res) {
          setFilePath(res.filePath)
          addRecentFile(res.filePath)
          setRecentFiles(loadRecentFiles())
          triggerToast('File saved successfully!')
          await window.electronAPI.clearRecovery({ fileName: res.filePath.split(/[\\/]/).pop() || 'Untitled' })
          logActivity('Saved Document File', '💾', 'success', `Saved to path: ${res.filePath}`)
        }
      } else {
        triggerToast('Desktop API not found (saved in local memory)')
        logActivity('Saved Mock Document', '💾', 'warning', 'Stored in active browser local memory.')
      }
    } catch (err: any) {
      console.error(err)
      triggerToast('Failed to save file.')
      logActivity('Failed to Save File', '💾', 'error', err?.message || String(err))
    }
  }

  const buildExportHtml = () => {
    if (!editorInstance || editorInstance.isDestroyed) return null
    return editorInstance.getHTML()
  }

  const handleExportPDF = async () => {
    try {
      const pageHtml = buildExportHtml()
      if (!pageHtml) {
        triggerToast('Failed to export PDF: No content available.')
        return
      }

      const styledPrintHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.css">
  <style>
    @page {
      size: A4;
      margin: 2cm 2.5cm;
    }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', 'Calibri', Arial, sans-serif;
      font-size: 11pt;
      color: #323130;
      line-height: 1.65;
      margin: 0;
      padding: 0;
    }
    h1 {
      font-size: 22pt;
      font-weight: 700;
      color: #2b579a;
      border-bottom: 1.5px solid #d2d0ce;
      padding-bottom: 6px;
      margin-top: 24px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }
    h2 {
      font-size: 17pt;
      font-weight: 600;
      color: #2b579a;
      margin-top: 20px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 13pt;
      font-weight: 600;
      color: #404040;
      margin-top: 16px;
      margin-bottom: 4px;
      page-break-after: avoid;
    }
    h4, h5, h6 {
      font-size: 11pt;
      font-weight: 600;
      color: #404040;
      margin-top: 12px;
      margin-bottom: 4px;
    }
    p {
      font-size: 11pt;
      margin-top: 0;
      margin-bottom: 8px;
      orphans: 3;
      widows: 3;
    }
    blockquote {
      border-left: 3px solid #2b579a;
      padding-left: 14px;
      margin: 12px 0;
      font-style: italic;
      color: #605e5c;
      page-break-inside: avoid;
    }
    pre, code {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 9.5pt;
    }
    pre {
      background-color: #f5f5f5;
      border: 1px solid #e1dfdd;
      border-radius: 4px;
      padding: 12px;
      margin: 10px 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      page-break-inside: avoid;
    }
    code {
      background-color: #f0f0f0;
      padding: 1px 4px;
      border-radius: 3px;
    }
    pre code {
      background: none;
      padding: 0;
    }
    .supermd-code-block {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 12px;
      border-radius: 6px;
      font-family: 'Consolas', monospace;
      font-size: 9.5pt;
      white-space: pre-wrap;
      page-break-inside: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #c8c6c4;
      padding: 6px 10px;
      text-align: left;
      font-size: 10pt;
    }
    th {
      background-color: #f3f2f1;
      font-weight: 600;
      color: #323130;
    }
    ul, ol {
      margin-top: 4px;
      margin-bottom: 8px;
      padding-left: 24px;
    }
    li {
      margin-bottom: 2px;
    }
    ul[data-type="taskList"] {
      list-style: none;
      padding-left: 0;
    }
    ul[data-type="taskList"] li {
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }
    a {
      color: #2b579a;
      text-decoration: underline;
    }
    hr {
      border: none;
      border-top: 1px solid #d2d0ce;
      margin: 14px 0;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    mark {
      background-color: #ffff00;
      padding: 0 2px;
    }
    del, s {
      text-decoration: line-through;
      color: #a19f9d;
    }
    .mermaid-rendered-container {
      text-align: center;
      margin: 12px 0;
      page-break-inside: avoid;
    }
    .mermaid-svg-frame {
      display: flex;
      justify-content: center;
    }
    .mermaid-svg-frame svg {
      max-width: 100%;
      height: auto;
    }
    sup { vertical-align: super; font-size: 8pt; }
    sub { vertical-align: sub; font-size: 8pt; }
    u { text-decoration: underline; }
    .katex { font-size: 1em; }
  </style>
</head>
<body>
  ${pageHtml}
</body>
</html>`

      if (window.electronAPI) {
        const res = await window.electronAPI.exportPDF({ htmlContent: styledPrintHtml, filePath })
        if (res.success) {
          triggerToast(`Successfully exported PDF to ${res.filePath?.split(/[\\/]/).pop()}`)
          logActivity('Exported to PDF', '📥', 'success', `File: ${res.filePath}`)
        }
      } else {
        // Fallback for Web browser environment: print using a temporary offscreen iframe
        const iframe = document.createElement('iframe')
        iframe.style.position = 'fixed'
        iframe.style.right = '0'
        iframe.style.bottom = '0'
        iframe.style.width = '0'
        iframe.style.height = '0'
        iframe.style.border = '0'
        document.body.appendChild(iframe)
        
        const doc = iframe.contentWindow?.document || iframe.contentDocument
        if (doc) {
          doc.open()
          doc.write(styledPrintHtml)
          doc.close()
          
          // Wait for images and async resources to load inside the iframe before printing
          setTimeout(() => {
            try {
              iframe.contentWindow?.focus()
              iframe.contentWindow?.print()
            } catch (printErr) {
              console.error('Web print error:', printErr)
            } finally {
              document.body.removeChild(iframe)
            }
            triggerToast('Opened browser print preview')
            logActivity('Opened Browser Print Fallback', '📥', 'success', 'Rendered document inside temporary iframe for web browser printing.')
          }, 1500)
        } else {
          document.body.removeChild(iframe)
          triggerToast('Failed to initialize browser printing')
        }
      }
    } catch (err: any) {
      console.error(err)
      triggerToast('Error exporting PDF.')
      logActivity('Failed to Export PDF', '📥', 'error', err?.message || String(err))
    }
  }

  const handleExportDOCX = async () => {
    try {
      const pageHtml = buildExportHtml()
      if (window.electronAPI && pageHtml) {
        const res = await window.electronAPI.exportDOCX({ htmlContent: pageHtml, filePath })
        if (res.success) {
          triggerToast(`Successfully exported DOCX to ${res.filePath?.split(/[\\/]/).pop()}`)
          logActivity('Exported to MS Word DOCX', '📝', 'success', `File: ${res.filePath}`)
        }
      } else {
        // Fallback for web: download raw markdown
        const blob = new Blob([markdown], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = (filePath?.split(/[\\/]/).pop() || 'document').replace(/\.md$/, '') + '.md'
        a.click()
        URL.revokeObjectURL(url)
        triggerToast('DOCX export requires the desktop app. Downloaded markdown as fallback.')
        logActivity('Exported Fallback Markdown', '📝', 'warning', 'DOCX requires desktop app.')
      }
    } catch (err: any) {
      console.error(err)
      triggerToast('Error exporting DOCX.')
      logActivity('Failed to Export DOCX', '📝', 'error', err?.message || String(err))
    }
  }

  const handleInsertTOC = () => {
    const toc = generateTOC(markdown)
    setMarkdown((prev) => toc + '\n' + prev)
    triggerToast('Table of Contents inserted at top')
    logActivity('Generated Table of Contents', '📑', 'success', 'TOC hierarchy prepended to document.')
  }

  // Handle theme changes
  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    logActivity(`Theme Changed to ${newTheme.toUpperCase()}`, '🎨', 'success')
    switch (newTheme) {
      case 'dark':
        setIsDarkMode(true)
        break
      case 'light':
        setIsDarkMode(false)
        break
      case 'sepia':
        setIsDarkMode(false)
        break
      case 'solarized':
        setIsDarkMode(true)
        break
    }
  }

  // Background Auto-Save Recovery snapshot hooks
  useEffect(() => {
    if (!window.electronAPI) return

    const interval = setInterval(async () => {
      const fileName = filePath ? (filePath.split(/[\\/]/).pop() || null) : null
      await window.electronAPI.autoSave({ content: markdown, fileName })
    }, 30000)

    return () => clearInterval(interval)
  }, [markdown, filePath])

  // Look for any existing auto-saved recovered crash files on initial start
  useEffect(() => {
    if (!window.electronAPI) return

    const checkForCrashRecovery = async () => {
      const fileName = filePath ? (filePath.split(/[\\/]/).pop() || null) : null
      const res = await window.electronAPI.checkRecovery({ fileName })
      if (res.hasRecovery && res.content) {
        const confirmRestore = window.confirm(
          'SuperMD detected an unsaved auto-save recovery file from a previous session. Would you like to restore it?'
        )
        if (confirmRestore) {
          setMarkdown(res.content)
          triggerToast('Unsaved changes restored!')
        } else {
          await window.electronAPI.clearRecovery({ fileName })
        }
      }
    }
    checkForCrashRecovery()
  }, [filePath, triggerToast])

  // Synchronize dynamic theme mode variable modifications to html element classes
  useEffect(() => {
    // Remove all theme classes first
    document.body.classList.remove('dark-mode', 'sepia-mode', 'solarized-mode')

    switch (theme) {
      case 'dark':
        document.body.classList.add('dark-mode')
        break
      case 'sepia':
        document.body.classList.add('sepia-mode')
        break
      case 'solarized':
        document.body.classList.add('solarized-mode')
        break
      default:
        // Light mode - no extra class needed
        break
    }

    // Sync isDarkMode with actual class
    if (isDarkMode && !document.body.classList.contains('dark-mode') && !document.body.classList.contains('solarized-mode')) {
      document.body.classList.add('dark-mode')
    } else if (!isDarkMode) {
      // Don't remove if we're in a specific theme that handles it
      if (!document.body.classList.contains('sepia-mode') && !document.body.classList.contains('solarized-mode')) {
        document.body.classList.remove('dark-mode')
      }
    }
  }, [isDarkMode, theme])

  // Debounced effect to log document synchronization across editing canvas
  useEffect(() => {
    if (markdown === DEFAULT_MARKDOWN) return // Skip logging for default page load

    const timer = setTimeout(() => {
      logActivity('Document Synchronized', '🔄', 'sync', `Source AST fully synced. Size: ${markdown.length} characters.`)
    }, 1500)
    
    return () => clearTimeout(timer)
  }, [markdown, logActivity])

  // Word count and Character calculations
  const getWordCount = () => {
    const text = markdown.replace(/[#*`_\\-]/g, '').trim()
    return text ? text.split(/\s+/).length : 0
  }

  const getCharCount = () => {
    return markdown.length
  }

  // Tiptap Command wrappers executed directly on the in-memory ProseMirror instance
  const runCommand = (command: (editor: any) => void, actionName?: string, icon?: string) => {
    const editor = editorInstance
    const isDestroyed = editor ? editor.isDestroyed : true
    console.log('[App runCommand] editor state:', {
      hasEditor: !!editor,
      isDestroyed: isDestroyed,
      hasCommands: editor && !isDestroyed ? !!editor.commands : false,
      selection: editor && !isDestroyed && editor.state ? { from: editor.state.selection.from, to: editor.state.selection.to } : null
    })
    if (editor && !isDestroyed && editor.commands) {
      try {
        command(editor)
        console.log('[App runCommand] Command successfully executed.')
        if (actionName && icon) {
          logActivity(actionName, icon, 'success', `Operation applied to active text selection.`)
        }
      } catch (err: any) {
        console.error('[runCommand] Error:', err)
        if (actionName && icon) {
          logActivity(actionName, icon, 'error', `Failed to apply operation: ${err?.message || err}`)
        }
      }
    } else {
      if (actionName && icon) {
        logActivity(actionName, icon, 'warning', `Editor not active or focused. Click on the document first.`)
      }
    }
  }

  return (
    <div className={`supermd-app-container ${theme === 'sepia' ? 'sepia-theme' : ''} ${theme === 'solarized' ? 'solarized-theme' : ''} ${distractionFree ? 'distraction-free' : ''}`}>
      {/* Ribbon toolbar interface */}
      <RibbonToolbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        editor={editorInstance}
        selectionTick={selectionTick}
        onBold={() => runCommand((e) => e.chain().focus().toggleBold().run(), 'Toggled Bold Formatting', '🅱️')}
        onItalic={() => runCommand((e) => e.chain().focus().toggleItalic().run(), 'Toggled Italic Formatting', '🇮')}
        onUnderline={() => runCommand((e) => e.chain().focus().toggleUnderline().run(), 'Toggled Underline Formatting', '🇺')}
        onStrike={() => runCommand((e) => e.chain().focus().toggleStrike().run(), 'Toggled Strikethrough', '🇸')}
        onParagraph={() => runCommand((e) => e.chain().focus().setParagraph().run(), 'Set Paragraph Style', '📝')}
        onHeading={(level) => runCommand((e) => e.chain().focus().toggleHeading({ level }).run(), `Toggled Heading ${level}`, '頭')}
        onBlockquote={() => runCommand((e) => e.chain().focus().toggleBlockquote().run(), 'Toggled Blockquote', '💬')}
        onHorizontalRule={() => runCommand((e) => e.chain().focus().setHorizontalRule().run(), 'Inserted Divider Line', '➖')}
        onFontFamily={(family) => runCommand((e) => e.chain().focus().setFontFamily(family).run(), `Font Family: ${family}`, '🔤')}
        onFontSize={(size) => runCommand((e) => e.chain().focus().setFontSize(size).run(), `Font Size: ${size}pt`, '🔢')}
        onTextColor={(color) => runCommand((e) => e.chain().focus().setColor(color).run(), `Text Color: ${color}`, '🎨')}
        onHighlightColor={(color) => {
          if (color === 'transparent') {
            runCommand((e) => e.chain().focus().unsetHighlight().run(), 'Removed Text Highlight', '🎨')
          } else {
            runCommand((e) => e.chain().focus().toggleHighlight({ color }).run(), `Applied Highlight: ${color}`, '🎨')
          }
        }}
        onAlignText={(align) => runCommand((e) => e.chain().focus().setTextAlign(align).run(), `Aligned Text: ${align}`, '☷')}
        marginType={marginType}
        setMarginType={setMarginType}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        onInsertTable={() => {
          runCommand((e) =>
            e.chain()
              .focus()
              .insertContent({
                type: 'supermdTable',
                attrs: {
                  cols: ['Header 1', 'Header 2'],
                  rows: [['Cell A', 'Cell B'], ['Cell C', 'Cell D']],
                },
              })
              .run()
          , 'Inserted Data Table', '📅')
        }}
        onInsertMermaid={() => {
          runCommand((e) =>
            e.chain()
              .focus()
              .insertContent({
                type: 'mermaidCode',
                attrs: { code: 'graph TD\n  A[Start] --> B(Edit Code)' },
              })
              .run()
          , 'Inserted Mermaid Diagram', '📊')
        }}
        onSave={handleSaveFile}
        onOpenFile={handleOpenFile}
        onNewFile={handleNewFile}
        onUndo={() => runCommand((e) => e.chain().focus().undo().run(), 'Undo Last Action', '↶')}
        onRedo={() => runCommand((e) => e.chain().focus().redo().run(), 'Redo Last Action', '↷')}
        onCut={() => {
          document.execCommand('cut')
          triggerToast('Cut')
          logActivity('Cut Content', '✂️', 'success')
        }}
        onCopy={() => {
          document.execCommand('copy')
          triggerToast('Copied to Clipboard')
          logActivity('Copied Content', '📋', 'success')
        }}
        onPaste={() => {
          navigator.clipboard.readText().then((text) => {
            if (text) {
              runCommand((e) => e.chain().focus().insertContent(text).run(), 'Pasted Clipboard Content', '📋')
            }
          })
        }}
        onExportPDF={handleExportPDF}
        onExportDOCX={handleExportDOCX}
        onInsertTOC={handleInsertTOC}
        onInsertTaskList={() => {
          runCommand((e) =>
            e.chain()
              .focus()
              .insertContent({
                type: 'taskList',
                content: [
                  {
                    type: 'taskItem',
                    attrs: { checked: false },
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New task' }] }],
                  },
                ],
              })
              .run()
          , 'Inserted Task List', '☑')
        }}
        onInsertMath={() => {
          const latex = prompt('Enter LaTeX formula:', 'E = mc^2')
          if (latex) {
            runCommand((e) =>
              e.chain()
                .focus()
                .insertContent({
                  type: 'mathBlock',
                  attrs: { latex },
                })
                .run()
            , 'Inserted Math Formula', '∑')
          }
        }}
        onInsertLink={() => {
          const url = prompt('Enter URL:')
          if (url) {
            runCommand((e) => e.chain().focus().setLink({ href: url }).run(), 'Inserted Link', '🔗')
          }
        }}
        filePath={filePath}
        theme={theme}
        onThemeChange={handleThemeChange}
        distractionFree={distractionFree}
        onDistractionFreeChange={setDistractionFree}
        shortcuts={shortcuts}
        onManageShortcuts={() => setIsShortcutsModalOpen(true)}
      />

      {/* Main Multi-Editor Split Workspace Canvas */}
      <div className={`supermd-workspace view-mode-${viewMode}`}>
        {/* COLLAPSIBLE ACTIVITY SIDEBAR */}
        {sidebarOpen && (
          <div className="workspace-sidebar activity-sidebar">
            <div className="sidebar-header">
              <span>📋 Activity & Sync Log</span>
              <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>×</button>
            </div>
            <div className="sidebar-actions-row">
              <button className="sidebar-clear-btn" onClick={() => setActivities([])}>Clear History</button>
            </div>
            <div className="activity-list-container">
              {activities.length === 0 ? (
                <div className="activity-empty-state">
                  <span>No activities logged yet. Edit text or click ribbon buttons.</span>
                </div>
              ) : (
                activities.map(act => (
                  <div key={act.id} className={`activity-card ${act.status}`}>
                    <div className="activity-card-top">
                      <span className="activity-icon">{act.icon}</span>
                      <span className="activity-title">{act.action}</span>
                      <span className="activity-time">{act.timestamp}</span>
                    </div>
                    {act.details && (
                      <div className="activity-card-details">
                        {act.details}
                      </div>
                    )}
                    <div className="activity-card-status">
                      <span className={`status-badge ${act.status}`}>
                        {act.status === 'success' && '✓ Applied'}
                        {act.status === 'sync' && '● Synced'}
                        {act.status === 'error' && '✗ Failed'}
                        {act.status === 'warning' && '⚠ Warning'}
                      </span>
                      <span className={`preview-status status-${act.status}`}>
                        {act.status === 'success' && 'Preview: Updating...'}
                        {act.status === 'sync' && 'Preview: Updated ✓'}
                        {act.status === 'error' && 'Preview: Out of Sync ✗'}
                        {act.status === 'warning' && 'Preview: Warning ⚠'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* WORD MODE (Rich WYSIWYG Page View) */}
        {/* WORD MODE (Rich WYSIWYG Page View) */}
        {(viewMode === 'word' || viewMode === 'split') && (
          <div className="workspace-panel word-panel">
            <WordEditor
              key={`word-editor-v${fileVersion}`}
              value={markdown}
              onChange={handleMarkdownChange}
              marginType={marginType}
              isFocused={true}
              onEditorReady={handleEditorReady}
              onSelectionChange={handleWordSelectionChange}
              selection={wordSelection}
            />
          </div>
        )}

        {/* MARKDOWN MODE (Raw IDE Editor View) */}
        {(viewMode === 'markdown' || viewMode === 'split') && (
          <div className="workspace-panel markdown-panel">
            <div className="markdown-settings-row">
              <label>
                <input 
                  type="checkbox" 
                  checked={showLineNumbers} 
                  onChange={() => setShowLineNumbers(!showLineNumbers)} 
                /> 
                Show Line Numbers
              </label>
              <label style={{ marginLeft: '12px' }}>
                <input 
                  type="checkbox" 
                  checked={showInvisibles} 
                  onChange={() => setShowInvisibles(!showInvisibles)} 
                /> 
                Show Special Characters
              </label>
            </div>
            
            <MarkdownEditor
              value={markdown}
              onChange={handleMarkdownChange}
              showLineNumbers={showLineNumbers}
              showInvisibles={showInvisibles}
              onSelectionChange={handleCodeSelectionChange}
              selection={codeSelection}
            />
          </div>
        )}
      </div>

      {/* Interactive Floating Status Toast Notification */}
      {toastMessage && (
        <div className="supermd-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Document Information & Control Status Bar */}
      {!distractionFree && (
        <div className="supermd-status-bar">
          <div className="status-bar-left">
            <span>Words: {getWordCount()}</span>
            <span className="status-divider">|</span>
            <span>Characters: {getCharCount()}</span>
            <span className="status-divider">|</span>
            <span>{readingTime(markdown)}</span>
          </div>
          <div className="status-bar-center">
            <span>{filePath ? `Location: ${filePath}` : 'Untitled (Local Scratch Draft)'}</span>
          </div>
          <div className="status-bar-right">
            <span className="sync-status-marker synchronized">● Synchronized</span>
            <span className="status-divider">|</span>
            <span>UTF-8</span>
            {recentFiles.length > 0 && (
              <>
                <span className="status-divider">|</span>
                <span className="recent-files-indicator" title={`Recent: ${recentFiles.map(f => f.name).join(', ')}`}>
                  📂 {recentFiles.length}
                </span>
              </>
            )}
          </div>
        </div>
      )}
      {/* Floating Sidebar Toggle Button when collapsed */}
      {!sidebarOpen && (
        <button 
          className="sidebar-toggle-trigger" 
          onClick={() => setSidebarOpen(true)}
          title="Open Activity History Sidebar"
        >
          📋 Activity Log
        </button>
      )}

      {/* Interactive Diagnostics Debug Panel */}
      <div className={`supermd-diagnostics ${!diagnosticsOpen ? 'collapsed' : ''}`} onClick={() => !diagnosticsOpen && setDiagnosticsOpen(true)}>
        {!diagnosticsOpen ? (
          <span>🛠️ Diagnostics</span>
        ) : (
          <div className="supermd-diagnostics-expanded">
            <div className="diagnostics-header" onClick={(e) => { e.stopPropagation(); setDiagnosticsOpen(false); }}>
              <span>🛠️ SuperMD Diagnostics</span>
              <button onClick={(e) => { e.stopPropagation(); setDiagLogs([]); }} style={{ marginLeft: '12px' }}>Clear Logs</button>
            </div>
            <div className="diagnostics-content">
              <div className="diagnostics-state-grid">
                <span className="diagnostics-state-label">View Mode:</span>
                <span className="diagnostics-state-value">{viewMode}</span>

                <span className="diagnostics-state-label">Has Editor:</span>
                <span className="diagnostics-state-value">{editorInstance && !editorInstance.isDestroyed ? 'Yes' : 'No'}</span>

                <span className="diagnostics-state-label">Editor Focused:</span>
                <span className="diagnostics-state-value">{(() => { try { return editorInstance && !editorInstance.isDestroyed && editorInstance.view?.focused ? 'Yes' : 'No' } catch { return 'No' } })()}</span>

                <span className="diagnostics-state-label">Selection:</span>
                <span className="diagnostics-state-value">
                  {(() => { try { return editorInstance && !editorInstance.isDestroyed ? `${editorInstance.state.selection.from} to ${editorInstance.state.selection.to}` : 'None' } catch { return 'None' } })()}
                </span>
                
                <span className="diagnostics-state-label">Selected Text:</span>
                <span className="diagnostics-state-value">
                  {(() => { try { return editorInstance && !editorInstance.isDestroyed && editorInstance.state ? `"${editorInstance.state.doc.textBetween(editorInstance.state.selection.from, editorInstance.state.selection.to)}"` : 'None' } catch { return 'None' } })()}
                </span>
              </div>
              <div className="diagnostics-logs">
                {diagLogs.length === 0 ? (
                  <span style={{ color: '#605e5c', fontStyle: 'italic' }}>No log messages yet. Click buttons to trace.</span>
                ) : (
                  diagLogs.map((log, idx) => (
                    <div key={idx} className={`diagnostics-log-line ${log.startsWith('[ERR]') ? 'error' : ''}`}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {isShortcutsModalOpen && (
        <div className="supermd-modal-overlay" onClick={() => setIsShortcutsModalOpen(false)}>
          <div className="supermd-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><span>⌨️</span> Keyboard Shortcuts Manager</h2>
              <button className="modal-close-btn" onClick={() => setIsShortcutsModalOpen(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="shortcuts-intro">
                Customize and view keyboard shortcuts for all formatting, editing, and insertion features in SuperMD. Press <strong>Escape</strong> at any time to cancel rebinding.
              </div>
              
              <div className="shortcuts-table-container">
                <table className="shortcuts-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Key Combo</th>
                      <th>Customize</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(shortcuts).map(([actionKey, config]) => {
                      const displayKeys = []
                      if (config.ctrl) displayKeys.push('Ctrl')
                      if (config.alt) displayKeys.push('Alt')
                      if (config.shift) displayKeys.push('Shift')
                      displayKeys.push(config.key.toUpperCase())

                      return (
                        <tr key={actionKey}>
                          <td>
                            <div className="shortcut-action-name">{config.label}</div>
                            <div className="shortcut-desc">{config.description}</div>
                          </td>
                          <td>
                            <div className="key-badge-container">
                              {displayKeys.map((k, idx) => (
                                <span key={idx} className="key-badge">{k}</span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <button
                              className="shortcut-action-btn"
                              onClick={() => {
                                setRebindingAction(actionKey)
                                setRebindingKeys(null)
                              }}
                            >
                              Rebind
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="modal-btn" 
                onClick={() => {
                  if (window.confirm('Are you sure you want to reset all shortcuts to their default settings?')) {
                    setShortcuts(DEFAULT_SHORTCUTS)
                    localStorage.setItem('supermd-keyboard-shortcuts', JSON.stringify(DEFAULT_SHORTCUTS))
                    triggerToast('Shortcuts reset to default!')
                    logActivity('Shortcuts Reset', '⌨️', 'success', 'All key combinations reset to system defaults.')
                  }
                }}
              >
                Reset to Default
              </button>
              <button className="modal-btn primary" onClick={() => setIsShortcutsModalOpen(false)}>Close</button>
            </div>

            {/* Rebinding Modal Backdrop/Panel */}
            {rebindingAction && (
              <div className="rebinding-backdrop">
                <div className="rebinding-panel">
                  <h3>Rebinding: <span className="rebinding-action-info">{shortcuts[rebindingAction]?.label}</span></h3>
                  <div className="rebinding-instruction">
                    Press any key combination to bind this action. Press <strong>Escape</strong> to cancel.
                  </div>
                  
                  <div className="detected-keys-box">
                    {rebindingKeys ? (
                      <div className="key-badge-container">
                        {rebindingKeys.ctrl && <span className="key-badge">Ctrl</span>}
                        {rebindingKeys.alt && <span className="key-badge">Alt</span>}
                        {rebindingKeys.shift && <span className="key-badge">Shift</span>}
                        <span className="key-badge">{rebindingKeys.key.toUpperCase()}</span>
                      </div>
                    ) : (
                      <span className="detected-keys-empty">Listening for keyboard input...</span>
                    )}
                  </div>
                  
                  <div className="rebinding-actions">
                    <button 
                      className="modal-btn primary" 
                      disabled={!rebindingKeys}
                      onClick={() => {
                        if (rebindingKeys) {
                          const updated = {
                            ...shortcuts,
                            [rebindingAction]: {
                              ...shortcuts[rebindingAction],
                              key: rebindingKeys.key,
                              ctrl: rebindingKeys.ctrl,
                              shift: rebindingKeys.shift,
                              alt: rebindingKeys.alt,
                            }
                          }
                          setShortcuts(updated)
                          localStorage.setItem('supermd-keyboard-shortcuts', JSON.stringify(updated))
                          triggerToast(`Rebound shortcut for ${shortcuts[rebindingAction].label}`)
                          logActivity(
                            `Shortcut Rebound`, 
                            '⌨️', 
                            'success', 
                            `${shortcuts[rebindingAction].label} bound to ${
                              (rebindingKeys.ctrl ? 'Ctrl+' : '') +
                              (rebindingKeys.alt ? 'Alt+' : '') +
                              (rebindingKeys.shift ? 'Shift+' : '') +
                              rebindingKeys.key.toUpperCase()
                            }`
                          )
                        }
                        setRebindingAction(null)
                        setRebindingKeys(null)
                      }}
                    >
                      Save Shortcut
                    </button>
                    <button 
                      className="modal-btn" 
                      onClick={() => {
                        setRebindingAction(null)
                        setRebindingKeys(null)
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
