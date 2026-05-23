import { useState, useEffect } from 'react'
import { RibbonToolbar } from './renderer/components/RibbonToolbar'
import { WordEditor } from './renderer/components/WordEditor'
import { MarkdownEditor } from './renderer/components/MarkdownEditor'
import './renderer/styles/app-layout.css'

declare global {
  interface Window {
    electronAPI: {
      openFile: () => Promise<{ filePath: string; content: string } | null>
      saveFile: (payload: { filePath: string | null; content: string }) => Promise<{ filePath: string; success: boolean } | null>
      autoSave: (payload: { content: string; fileName: string | null }) => Promise<{ success: boolean }>
      checkRecovery: (payload: { fileName: string | null }) => Promise<{ hasRecovery: boolean; content?: string }>
      clearRecovery: (payload: { fileName: string | null }) => Promise<{ success: boolean }>
      exportPDF: (payload: { htmlContent: string }) => Promise<{ success: boolean; filePath?: string }>
    }
  }
}

const DEFAULT_MARKDOWN = `# Welcome to NovaWriter!

NovaWriter is an enterprise-grade hybrid Markdown word processor that merges visual WYSIWYG editing with clean structural Markdown files.

## Core Features
- **MS Word ribbon interface** for rapid styling.
- **A4 physical margins** visualizer page rendering.
- **Bidirectional split view editor** with real-time AST coordination.
- **Mermaid diagram engine** compiled asynchronously in the background.

## Interactive Diagrams
Try editing the graph below by clicking on it:

<div data-type="mermaid" data-code="graph TD
  A[Start Coding] --> B(Scaffold Electron + React)
  B --> C{Bidirectional Sync}
  C -->|Yes| D[Wow User with High Fidelity]
  C -->|No| E[Cursor Jump Errors]"></div>

Enjoy using NovaWriter!
`

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
  const triggerSelectionTick = () => setSelectionTick((t) => t + 1)

  // Editor instance state from WordEditor
  const [editorInstance, setEditorInstance] = useState<any>(null)

  // Show status popup toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }

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
          triggerToast('File loaded successfully!')
        }
      } else {
        triggerToast('Desktop API not found (web mock)')
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
          triggerToast('File saved successfully!')
          // Clear any active auto-saves on success
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
        // Wrap with premium styles to ensure print outputs look correct
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
  }, [filePath])

  // Synchronize dynamic Dark Mode variable modifications to html element classes
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode')
    } else {
      document.body.classList.remove('dark-mode')
    }
  }, [isDarkMode])

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
    console.log('[runCommand] Executing editor command. Editor exists:', !!editor, 'isDestroyed:', editor?.isDestroyed)
    if (editor && !editor.isDestroyed && editor.commands) {
      try {
        command(editor)
        console.log('[runCommand] Command execution succeeded.')
      } catch (err) {
        console.error('[runCommand] Error executing editor command:', err)
      }
    }
  }

  return (
    <div className={`novawriter-app-container ${isDarkMode ? 'dark-mode' : ''}`}>
            {/* MS Word ribbon controls toolbar interface */}
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
              .insertContent('<table><tr><th>Header 1</th><th>Header 2</th></tr><tr><td>Cell A</td><td>Cell B</td></tr></table>')
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
        filePath={filePath}
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
            {/* Outline panel side drawer controller */}
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
      <div className="novawriter-status-bar">
        <div className="status-bar-left">
          <span>Words: {getWordCount()}</span>
          <span className="status-divider">|</span>
          <span>Characters: {getCharCount()}</span>
        </div>
        <div className="status-bar-center">
          <span>{filePath ? `Location: ${filePath}` : 'Untitled (Local Scratch Draft)'}</span>
        </div>
        <div className="status-bar-right">
          <span className="sync-status-marker synchronized">● Synchronized</span>
          <span className="status-divider">|</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  )
}

export default App
