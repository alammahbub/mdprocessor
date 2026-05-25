import { useState, useEffect, useCallback } from 'react'
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
      exportPDF: (payload: { htmlContent: string }) => Promise<{ success: boolean; filePath?: string }>
      exportDOCX?: (payload: { markdown: string }) => Promise<{ success: boolean; filePath?: string }>
      onSpellingSuggestions?: (callback: (data: { suggestions: string[]; misspelledWord: string; x: number; y: number }) => void) => () => void
    }
  }
}

const DEFAULT_MARKDOWN = `# Welcome to NovaWriter!

NovaWriter is an enterprise-grade hybrid Markdown word processor that merges visual WYSIWYG editing with clean structural Markdown files.

## Text Formatting

**Bold**, *Italic*, ***Bold Italic***, ~~Strikethrough~~, <u>Underline</u>, <mark>Highlight</mark>, <ins>Inserted</ins>, and \`Inline Code\`.

## Links & References

Check out the [Markdown Reference](https://www.markdownlang.com) for more syntax tips.

Automatic links are also supported: <https://www.markdownlang.com> and <email@example.com>

## Math Formulas

NovaWriter supports LaTeX math with KaTeX rendering. Both inline formulas like <span data-math-inline="E = mc^2"></span> and block formulas are fully supported.

Block formulas:

<div data-math-block="\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}"></div>

## Interactive Diagrams

Try editing the graph below by clicking on it:

<div data-type="mermaid" data-code="graph TD
  A[Start Coding] --> B(Scaffold Electron + React)
  B --> C{Bidirectional Sync}
  C -->|Yes| D[Wow User with High Fidelity]
  C -->|No| E[Cursor Jump Errors]"></div>

## Tables Support

| Feature | Status | Priority |
|:--------|:------:|--------:|
| Image Resize | ✅ | High |
| Table Columns | ✅ | High |
| TOC Generation | ✅ | Medium |
| Math Formulas | ✅ | High |

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
greet("NovaWriter");
\`\`\`

### Indented Code Block (4 spaces)

    This is an indented code block.
    It uses 4 spaces for indentation.

### Definition List

Using raw HTML for extended syntax support:

<dl>
  <dt>Markdown</dt>
  <dd>A lightweight markup language for formatting text.</dd>
  <dt>NovaWriter</dt>
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

Enjoy using NovaWriter!
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
const RECENT_FILES_KEY = 'novawriter-recent-files'

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

function App() {
  // Application State
  const [markdown, setMarkdown] = useState<string>(DEFAULT_MARKDOWN)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('Home')
  const [marginType, setMarginType] = useState<'normal' | 'narrow' | 'wide'>('normal')
  const [viewMode, setViewMode] = useState<'word' | 'markdown' | 'split'>('split')
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string>('')
  const [showLineNumbers, setShowLineNumbers] = useState<boolean>(true)
  const [showInvisibles, setShowInvisibles] = useState<boolean>(false)
  const [selectionTick, setSelectionTick] = useState<number>(0)
  const [distractionFree, setDistractionFree] = useState<boolean>(false)
  const [theme, setTheme] = useState<string>('light')
  const [recentFiles, setRecentFiles] = useState<{ path: string; name: string; timestamp: number }[]>([])
  const triggerSelectionTick = () => setSelectionTick((t) => t + 1)

  // Editor instance state from WordEditor
  const [editorInstance, setEditorInstance] = useState<any>(null)

  // Show status popup toast
  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }, [])

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
      triggerToast('New Document Created')
    }
  }

  const handleOpenFile = async () => {
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.openFile()
        if (res) {
          setMarkdown(res.content)
          setFilePath(res.filePath)
          addRecentFile(res.filePath)
          setRecentFiles(loadRecentFiles())
          triggerToast('File loaded successfully!')
        }
      } else {
        // Web mock: prompt for file path
        const mockPath = prompt('Enter file path to open:')
        if (mockPath) {
          setFilePath(mockPath)
          addRecentFile(mockPath)
          setRecentFiles(loadRecentFiles())
          triggerToast('Desktop API not found (mock open)')
        }
      }
    } catch (err) {
      console.error(err)
      triggerToast('Error loading file.')
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
        }
      } else {
        triggerToast('Desktop API not found (saved in local memory)')
      }
    } catch (err) {
      console.error(err)
      triggerToast('Failed to save file.')
    }
  }

  const handleExportPDF = async () => {
    try {
      if (window.electronAPI && editorInstance && !editorInstance.isDestroyed) {
        const pageHtml = editorInstance.getHTML()
        const styledPrintHtml = `
          <html>
            <head>
              <style>
                body { 
                  font-family: 'Segoe UI', sans-serif; 
                  padding: 40px; 
                  color: #323130;
                  line-height: 1.6;
                }
                h1 { color: #2b579a; font-size: 24pt; border-bottom: 1px solid #d2d0ce; padding-bottom: 6px; }
                h2 { color: #2b579a; font-size: 18pt; margin-top: 20px; }
                p { font-size: 11pt; }
                blockquote { border-left: 3px solid #2b579a; padding-left: 12px; margin: 15px 0; font-style: italic; color: #605e5c; }
                .novawriter-code-block { background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 6px; font-family: monospace; }
                .mermaid-rendered-container { border: 1px solid #e1dfdd; padding: 10px; border-radius: 6px; display: flex; justify-content: center; margin: 15px 0; }
                .mermaid-svg-frame svg { max-width: 100%; height: auto; }
                table { width: 100%; border-collapse: collapse; }
                td { border: 1px solid #d2d0ce; padding: 8px; }
              </style>
            </head>
            <body>
              ${pageHtml}
            </body>
          </html>
        `
        const res = await window.electronAPI.exportPDF({ htmlContent: styledPrintHtml })
        if (res.success) {
          triggerToast(`Successfully exported PDF to ${res.filePath?.split(/[\\/]/).pop()}`)
        }
      } else {
        triggerToast('PDF Exporter is only available in the Desktop App')
      }
    } catch (err) {
      console.error(err)
      triggerToast('Error exporting PDF.')
    }
  }

  const handleExportDOCX = async () => {
    try {
      if (window.electronAPI?.exportDOCX) {
        const res = await window.electronAPI.exportDOCX({ markdown })
        if (res.success) {
          triggerToast(`Successfully exported DOCX to ${res.filePath?.split(/[\\/]/).pop()}`)
        }
      } else {
        // Fallback: convert to simple HTML and trigger download
        const htmlContent = `
          <html>
            <body>
              <p><em>NovaWriter DOCX Export (HTML fallback — install @m2d/md2docx for full DOCX support)</em></p>
              <pre>${markdown}</pre>
            </body>
          </html>
        `
        const blob = new Blob([htmlContent], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = (filePath?.split(/[\\/]/).pop() || 'document').replace(/\.md$/, '') + '.html'
        a.click()
        URL.revokeObjectURL(url)
        triggerToast('DOCX export requires desktop app. Downloaded as HTML fallback.')
      }
    } catch (err) {
      console.error(err)
      triggerToast('Error exporting DOCX.')
    }
  }

  const handleInsertTOC = () => {
    const toc = generateTOC(markdown)
    setMarkdown((prev) => toc + '\n' + prev)
    triggerToast('Table of Contents inserted at top')
  }

  // Handle theme changes
  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
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
          'NovaWriter detected an unsaved auto-save recovery file from a previous session. Would you like to restore it?'
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

  // Word count and Character calculations
  const getWordCount = () => {
    const text = markdown.replace(/[#*`_\\-]/g, '').trim()
    return text ? text.split(/\s+/).length : 0
  }

  const getCharCount = () => {
    return markdown.length
  }

  // Tiptap Command wrappers executed directly on the in-memory ProseMirror instance
  const runCommand = (command: (editor: any) => void) => {
    const editor = editorInstance
    if (editor && !editor.isDestroyed && editor.commands) {
      try {
        command(editor)
      } catch (err) {
        console.error('[runCommand] Error:', err)
      }
    }
  }

  return (
    <div className={`novawriter-app-container ${theme === 'sepia' ? 'sepia-theme' : ''} ${theme === 'solarized' ? 'solarized-theme' : ''} ${distractionFree ? 'distraction-free' : ''}`}>
      {/* Ribbon toolbar interface */}
      <RibbonToolbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        editor={editorInstance}
        selectionTick={selectionTick}
        onBold={() => runCommand((e) => e.chain().focus().toggleBold().run())}
        onItalic={() => runCommand((e) => e.chain().focus().toggleItalic().run())}
        onUnderline={() => runCommand((e) => e.chain().focus().toggleUnderline().run())}
        onStrike={() => runCommand((e) => e.chain().focus().toggleStrike().run())}
        onParagraph={() => runCommand((e) => e.chain().focus().setParagraph().run())}
        onHeading={(level) => runCommand((e) => e.chain().focus().toggleHeading({ level }).run())}
        onBlockquote={() => runCommand((e) => e.chain().focus().toggleBlockquote().run())}
        onHorizontalRule={() => runCommand((e) => e.chain().focus().setHorizontalRule().run())}
        onFontFamily={(family) => runCommand((e) => e.chain().focus().setFontFamily(family).run())}
        onFontSize={(size) => runCommand((e) => e.chain().focus().setFontSize(size).run())}
        onTextColor={(color) => runCommand((e) => e.chain().focus().setColor(color).run())}
        onHighlightColor={(color) => {
          if (color === 'transparent') {
            runCommand((e) => e.chain().focus().unsetHighlight().run())
          } else {
            runCommand((e) => e.chain().focus().toggleHighlight({ color }).run())
          }
        }}
        onAlignText={(align) => runCommand((e) => e.chain().focus().setTextAlign(align).run())}
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
                type: 'novawriterTable',
                attrs: {
                  cols: ['Header 1', 'Header 2'],
                  rows: [['Cell A', 'Cell B'], ['Cell C', 'Cell D']],
                },
              })
              .run()
          )
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
          )
        }}
        onSave={handleSaveFile}
        onOpenFile={handleOpenFile}
        onNewFile={handleNewFile}
        onUndo={() => runCommand((e) => e.chain().focus().undo().run())}
        onRedo={() => runCommand((e) => e.chain().focus().redo().run())}
        onCut={() => {
          document.execCommand('cut')
          triggerToast('Cut')
        }}
        onCopy={() => {
          document.execCommand('copy')
          triggerToast('Copied to Clipboard')
        }}
        onPaste={() => {
          navigator.clipboard.readText().then((text) => {
            if (text) {
              runCommand((e) => e.chain().focus().insertContent(text).run())
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
          )
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
            )
          }
        }}
        onInsertLink={() => {
          const url = prompt('Enter URL:')
          if (url) {
            runCommand((e) => e.chain().focus().setLink({ href: url }).run())
          }
        }}
        filePath={filePath}
        theme={theme}
        onThemeChange={handleThemeChange}
        distractionFree={distractionFree}
        onDistractionFreeChange={setDistractionFree}
      />

      {/* Main Multi-Editor Split Workspace Canvas */}
      <div className="novawriter-workspace">
        {/* WORD MODE (Rich WYSIWYG Page View) */}
        {(viewMode === 'word' || viewMode === 'split') && (
          <div className="workspace-panel word-panel">
            <WordEditor
              value={markdown}
              onChange={setMarkdown}
              marginType={marginType}
              isFocused={true}
              onEditorReady={(editor) => {
                setEditorInstance(editor)
              }}
              onSelectionChange={triggerSelectionTick}
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
              onChange={setMarkdown}
              showLineNumbers={showLineNumbers}
              showInvisibles={showInvisibles}
            />
          </div>
        )}
      </div>

      {/* Interactive Floating Status Toast Notification */}
      {toastMessage && (
        <div className="novawriter-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Document Information & Control Status Bar */}
      {!distractionFree && (
        <div className="novawriter-status-bar">
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
    </div>
  )
}

export default App
