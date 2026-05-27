import React, { useEffect, useState, useRef, useCallback } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import mermaid from 'mermaid'
import './mermaid-editor.css'

// Initialize Mermaid once
mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
})

// Regex-based robust parser to inject/merge selected theme into Mermaid's initialization directive
function injectThemeDirective(code: string, theme: string): string {
  const cleanCode = code.trim()
  
  // Regex to match the Mermaid init directive at the start of code
  const directiveRegex = /^%%\s*\{\s*init\s*:\s*(\{[\s\S]*?\}\s*)\s*\}\s*%%/i
  const match = cleanCode.match(directiveRegex)
  
  if (match) {
    let configStr = match[1].trim()
    
    // Check if 'theme' or "theme" key already exists
    const themeKeyRegex = /(["']?theme["']?\s*:\s*)(["'])(.*?)\2/
    if (themeKeyRegex.test(configStr)) {
      // Replace existing theme
      configStr = configStr.replace(themeKeyRegex, `$1$2${theme}$2`)
    } else {
      // Insert theme at the beginning of the object config
      configStr = configStr.replace(/^\{\s*/, `{\n  'theme': '${theme}',\n  `)
    }
    
    // Replace the old directive with the new one
    return cleanCode.replace(directiveRegex, `%%{init: ${configStr}}%%`)
  } else {
    // No directive exists, prepend a new one
    return `%%{init: {'theme': '${theme}'}}%%\n${cleanCode}`
  }
}

// Dynamically adjusts custom inline style statements (e.g. style A fill:...) in the Mermaid code to harmonize with the chosen theme palette
function updateStyleDefinitions(code: string, theme: string): string {
  const lines = code.split('\n')
  const updatedLines = lines.map((line) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('style A ')) {
      switch (theme) {
        case 'dark':
          return line.replace(/style A .*/, '  style A fill:#313244,stroke:#cba6f7,stroke-width:2px')
        case 'forest':
          return line.replace(/style A .*/, '  style A fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px')
        case 'neutral':
          return line.replace(/style A .*/, '  style A fill:#f3f2f1,stroke:#8a8886,stroke-width:2px')
        case 'base':
          return line.replace(/style A .*/, '  style A fill:#eae6ff,stroke:#5c2d91,stroke-width:2px')
        case 'default':
        default:
          return line.replace(/style A .*/, '  style A fill:#f9f,stroke:#333,stroke-width:2px')
      }
    }
    if (trimmed.startsWith('style D ')) {
      switch (theme) {
        case 'dark':
          return line.replace(/style D .*/, '  style D fill:#181825,stroke:#a6e3a1,stroke-width:2px')
        case 'forest':
          return line.replace(/style D .*/, '  style D fill:#c8e6c9,stroke:#1b5e20,stroke-width:2px')
        case 'neutral':
          return line.replace(/style D .*/, '  style D fill:#e1dfdd,stroke:#605e5c,stroke-width:2px')
        case 'base':
          return line.replace(/style D .*/, '  style D fill:#f3f0ff,stroke:#805ad5,stroke-width:2px')
        case 'default':
        default:
          return line.replace(/style D .*/, '  style D fill:#bbf,stroke:#f66,stroke-width:2px')
      }
    }
    return line
  })
  return updatedLines.join('\n')
}

// 10 high-fidelity pre-configured Mermaid templates to showcase standard and advanced features
const MERMAID_TEMPLATES = [
  {
    name: 'Flowchart',
    icon: '📊',
    code: `graph TD
  A[Start Coding] --> B(Scaffold Electron + React)
  B --> C{Bidirectional Sync}
  C -->|Yes| D[Wow User with High Fidelity]
  C -->|No| E[Cursor Jump Errors]
  style A fill:#f9f,stroke:#333,stroke-width:2px
  style D fill:#bbf,stroke:#f66,stroke-width:2px`
  },
  {
    name: 'Sequence Diagram',
    icon: '💬',
    code: `sequenceDiagram
  Alice->>John: Hello John, how are you?
  loop Healthcheck
      John->>John: Fight against bugs
  end
  Note right of John: Rational thoughts!
  John-->>Alice: Great!
  John->>Bob: How about you?
  Bob-->>John: Jolly good!`
  },
  {
    name: 'Gantt Chart',
    icon: '📅',
    code: `gantt
  title A Gantt Diagram
  dateFormat YYYY-MM-DD
  section Section
    A task           :a1, 2026-05-20, 30d
    Another task     :after a1, 20d
  section Another
    Task in Another  :2026-05-26, 12d
    another task     :24d`
  },
  {
    name: 'Class Diagram',
    icon: '🧬',
    code: `classDiagram
  Animal <|-- Duck
  Animal <|-- Fish
  Animal <|-- Zebra
  Animal : +int age
  Animal : +String gender
  Animal: +isMammal()
  Animal: +mate()
  class Duck{
      +String beakColor
      +swim()
      +quack()
  }
  class Fish{
      -int sizeInFeet
      -canEat()
  }`
  },
  {
    name: 'State Diagram',
    icon: '🔄',
    code: `stateDiagram-v2
  [*] --> Still
  Still --> [*]
  Still --> Moving
  Moving --> Still
  Moving --> Crash
  Crash --> [*]`
  },
  {
    name: 'Entity Relationship',
    icon: '🗄️',
    code: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE-ITEM : contains
  CUSTOMER }|..|{ DELIVERY-ADDRESS : uses`
  },
  {
    name: 'Mindmap',
    icon: '🧠',
    code: `mindmap
  root((SuperMD))
    Aesthetic UI
      Glassmorphism
      Harmonious themes
    AST Sync Engine
      Tiptap Core
      CodeMirror 6
    Diagrams
      Mermaid Charts
      Math LaTeX`
  },
  {
    name: 'Pie Chart',
    icon: '🍰',
    code: `pie title Key Features of SuperMD
  "Word Canvas WYSIWYG" : 45
  "Markdown Live Sync" : 35
  "Mermaid Vector Render" : 15
  "KaTeX Math Formulas" : 5`
  },
  {
    name: 'Timeline',
    icon: '⏳',
    code: `timeline
  title History of Word Processors
  1983 : Microsoft Word 1.0 released
  2004 : Markdown syntax created by John Gruber
  2015 : VS Code released by Microsoft
  2026 : SuperMD hybrid processor launched`
  },
  {
    name: 'Git Graph',
    icon: '🌿',
    code: `gitGraph
  commit
  commit
  branch develop
  checkout develop
  commit
  commit
  checkout main
  merge develop
  commit`
  }
]

export const MermaidNodeView: React.FC<NodeViewProps> = ({ node, updateAttributes, selected, editor, getPos }) => {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [tempCode, setTempCode] = useState<string>(node.attrs.code !== undefined ? node.attrs.code : node.textContent || '')
  const [tempTheme, setTempTheme] = useState<string>(node.attrs.theme || 'neutral')
  const [syntaxError, setSyntaxError] = useState<string>('')
  const [isValidating, setIsValidating] = useState<boolean>(false)
  const [width, setWidth] = useState<number>(node.attrs.width || 600)
  const [isResizing, setIsResizing] = useState<boolean>(false)
  const [editingNode, setEditingNode] = useState<{
    id: string
    text: string
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  const renderIdRef = useRef<string>(`mermaid-${Math.floor(Math.random() * 1000000)}`)
  const containerRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const widthRef = useRef(width)

  // Keep widthRef in sync with state
  useEffect(() => {
    widthRef.current = width
  }, [width])

  // Sync width state from node attributes
  useEffect(() => {
    if (node.attrs.width) {
      setWidth(node.attrs.width)
    }
  }, [node.attrs.width])

  // Sync state when node attributes or content update externally
  useEffect(() => {
    const code = node.attrs.code !== undefined ? node.attrs.code : node.textContent || ''
    setTempCode(code)
  }, [node.attrs.code, node.textContent])

  // Sync tempTheme state when node attributes update externally
  useEffect(() => {
    setTempTheme(node.attrs.theme || 'neutral')
  }, [node.attrs.theme])

  const compileDiagram = async (code: string, currentTheme: string = node.attrs.theme || 'neutral') => {
    try {
      setError('')
      const cleanCode = code.trim()
      if (!cleanCode) {
        setSvg('')
        return
      }

      // Prepend or merge the theme directive before compiling
      const themedCode = injectThemeDirective(cleanCode, currentTheme)

      // Render the mermaid chart to SVG asynchronously
      const { svg: renderedSvg } = await mermaid.render(renderIdRef.current, themedCode)
      setSvg(renderedSvg)
    } catch (err: any) {
      console.warn('Mermaid compile warning:', err)
      setError(err?.message || 'Syntax Error: Check connection arrows or syntax keywords.')
      // Clear the element with the render ID from DOM if Mermaid left it behind
      const badElement = document.getElementById(renderIdRef.current)
      if (badElement) {
        badElement.remove()
      }
    }
  }

  // Compile when code or theme attributes update
  useEffect(() => {
    const code = node.attrs.code !== undefined ? node.attrs.code : node.textContent || ''
    compileDiagram(code, node.attrs.theme || 'neutral')
  }, [node.attrs.code, node.textContent, node.attrs.theme])

  // Debounced Syntax Validation inside the Edit Overlay Modal
  useEffect(() => {
    if (!isEditing) {
      setSyntaxError('')
      return
    }

    const timer = setTimeout(async () => {
      const codeToValidate = tempCode.trim()
      if (!codeToValidate) {
        setSyntaxError('')
        return
      }

      setIsValidating(true)
      try {
        const themedCode = injectThemeDirective(codeToValidate, tempTheme)
        await mermaid.parse(themedCode)
        setSyntaxError('')
      } catch (err: any) {
        setSyntaxError(err?.message || 'Syntax Error: Check connection arrows or syntax keywords.')
      } finally {
        setIsValidating(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [tempCode, tempTheme, isEditing])

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTempCode(e.target.value)
  }

  const getDiagramCode = () => {
    return node.attrs.code !== undefined ? node.attrs.code : node.textContent || ''
  }

  const handleApplyChanges = () => {
    const updatedCode = updateStyleDefinitions(tempCode, tempTheme)
    
    if (node.attrs.code !== undefined) {
      updateAttributes({ 
        code: updatedCode,
        theme: tempTheme
      })
    } else {
      // It is a standard codeBlock node!
      const { state, dispatch } = editor.view
      const pos = typeof getPos === 'function' ? (getPos() as number) : 0
      const start = pos + 1
      const end = pos + 1 + node.textContent.length
      
      const transaction = state.tr.insertText(updatedCode, start, end)
      dispatch(transaction)
      updateAttributes({ theme: tempTheme })
    }

    if (typeof (window as any).logActivity === 'function') {
      (window as any).logActivity(
        'Updated Mermaid Diagram',
        '📊',
        'success',
        `Graph compiled successfully with "${tempTheme}" color palette theme.`
      )
    }
    setIsEditing(false)
  }

  const handleThemeQuickChange = (newTheme: string) => {
    const currentCode = getDiagramCode()
    const updatedCode = updateStyleDefinitions(currentCode, newTheme)
    
    if (node.attrs.code !== undefined) {
      updateAttributes({ 
        theme: newTheme,
        code: updatedCode
      })
    } else {
      // It is a standard codeBlock node!
      const { state, dispatch } = editor.view
      const pos = typeof getPos === 'function' ? (getPos() as number) : 0
      const start = pos + 1
      const end = pos + 1 + node.textContent.length
      
      const transaction = state.tr.insertText(updatedCode, start, end)
      dispatch(transaction)
      updateAttributes({ theme: newTheme })
    }

    setTempTheme(newTheme)
    setTempCode(updatedCode)
    if (typeof (window as any).logActivity === 'function') {
      (window as any).logActivity(
        `Theme Switched to ${newTheme.toUpperCase()}`,
        '🎨',
        'success',
        `Mermaid diagram rendered with the "${newTheme}" color theme.`
      )
    }
  }

  const updateMermaidNodeText = (code: string, nodeId: string, newText: string): string => {
    const escapeRegExp = (str: string) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
    // Match nodeId (using word boundaries) followed by brackets/braces/quotes containing the old text.
    const regex = new RegExp(`\\b(${escapeRegExp(nodeId)})\\s*([\\[\\(\\{>]+(?:\\\\|/)?(?:")?)(.*?)(?:")?(?:\\\\|/)?([\\]\\)\\}]+)`, 'g')
    
    return code.replace(regex, (_match, prefix, openBrackets, _label, closeBrackets) => {
      return `${prefix}${openBrackets}${newText}${closeBrackets}`
    })
  }

  const handleInlineEditApply = () => {
    if (!editingNode) return
    const currentCode = getDiagramCode()
    const updatedCode = updateMermaidNodeText(currentCode, editingNode.id, editingNode.text)
    
    if (node.attrs.code !== undefined) {
      updateAttributes({ code: updatedCode })
    } else {
      // It is a standard codeBlock node!
      const { state, dispatch } = editor.view
      const pos = typeof getPos === 'function' ? (getPos() as number) : 0
      const start = pos + 1
      const end = pos + 1 + node.textContent.length
      
      const transaction = state.tr.insertText(updatedCode, start, end)
      dispatch(transaction)
    }

    setTempCode(updatedCode)
    if (typeof (window as any).logActivity === 'function') {
      (window as any).logActivity(
        `Edited Node "${editingNode.id}" inline`,
        '📊',
        'success',
        `Updated label to: "${editingNode.text}"`
      )
    }
    setEditingNode(null)
  }

  const handleContainerClick = (e: React.MouseEvent) => {
    if (isResizing) return

    // Traverse up to see if a node default group was clicked
    const nodeGroup = (e.target as HTMLElement).closest('.node')
    if (nodeGroup) {
      e.preventDefault()
      e.stopPropagation()
      
      const rawId = nodeGroup.getAttribute('id') || ''
      // Strip render prefix (e.g. "mermaid-543040-"), standard flowchart prefixes, and any trailing digits
      let parsedId = rawId.replace(/^mermaid-\d+-/, '')
      parsedId = parsedId.replace(/^flowchart-node-/, '')
      parsedId = parsedId.replace(/^flowchart-/, '')
      parsedId = parsedId.replace(/-\d+$/, '')

      const text = nodeGroup.textContent?.trim() || ''
      const rect = nodeGroup.getBoundingClientRect()
      
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        setEditingNode({
          id: parsedId,
          text,
          x: rect.left - containerRect.left,
          y: rect.top - containerRect.top,
          width: rect.width,
          height: rect.height,
        })
      }
      return
    }

    // Clicked elsewhere on the diagram (like background, lines) -> open standard card editor
    setIsEditing(true)
  }

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, corner: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    startXRef.current = e.clientX
    startWidthRef.current = widthRef.current

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startXRef.current
      let newWidth: number

      if (corner === 'se') {
        newWidth = Math.max(200, startWidthRef.current + dx)
      } else if (corner === 'sw') {
        newWidth = Math.max(200, startWidthRef.current - dx)
      } else {
        newWidth = Math.max(200, startWidthRef.current + dx)
      }

      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      const finalWidth = Math.round(widthRef.current)
      updateAttributes({ width: finalWidth })
      if (typeof (window as any).logActivity === 'function') {
        (window as any).logActivity(
          'Resized Mermaid Diagram',
          '📊',
          'success',
          `Width adjusted to ${finalWidth}px.`
        )
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [updateAttributes])

  return (
    <NodeViewWrapper className="mermaid-wrapper" contentEditable={false}>
      <div 
        ref={containerRef}
        className={`mermaid-rendered-container ${isEditing ? 'blurred' : ''} ${selected ? 'selected' : ''} ${isResizing ? 'resizing' : ''}`}
        style={{ width: `${width}px`, maxWidth: '100%' }}
        onClick={handleContainerClick}
        title="Click node to edit inline, click empty space to edit code, drag handles to resize"
      >
        {svg ? (
          <div className="mermaid-svg-frame" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="mermaid-placeholder">
            <span>📊 [Click to Create Mermaid Diagram]</span>
          </div>
        )}

        {/* Floating Glassmorphism Toolbar */}
        <div className="mermaid-floating-toolbar" onClick={(e) => e.stopPropagation()}>
          <div className="toolbar-section theme-section">
            <span className="toolbar-label">Palette:</span>
            <div className="toolbar-theme-buttons">
              {[
                { name: 'default', color: '#2b579a', label: 'Default' },
                { name: 'neutral', color: '#8a8886', label: 'Neutral' },
                { name: 'dark', color: '#201f1e', label: 'Dark' },
                { name: 'forest', color: '#107c41', label: 'Forest' },
                { name: 'base', color: '#5c2d91', label: 'Base' },
              ].map((t) => (
                <button
                  key={t.name}
                  className={`toolbar-theme-btn ${node.attrs.theme === t.name || (!node.attrs.theme && t.name === 'neutral') ? 'active' : ''}`}
                  style={{ '--theme-color': t.color } as React.CSSProperties}
                  onClick={() => handleThemeQuickChange(t.name)}
                  title={`Switch to ${t.label} theme`}
                />
              ))}
            </div>
            <span className="toolbar-active-theme-text">({node.attrs.theme || 'neutral'})</span>
          </div>
          <div className="toolbar-divider" />
          <button 
            className="toolbar-action-btn edit-code-btn"
            onClick={() => setIsEditing(true)}
            title="Edit Diagram Code (Mermaid DSL)"
          >
            📝 Edit Code
          </button>
        </div>

        {/* Inline Node Text Input Overlay */}
        {editingNode && (
          <input
            type="text"
            className="mermaid-inline-input"
            value={editingNode.text}
            style={{
              position: 'absolute',
              top: `${editingNode.y}px`,
              left: `${editingNode.x}px`,
              width: `${editingNode.width}px`,
              height: `${editingNode.height}px`,
              fontSize: '12px',
              textAlign: 'center',
              zIndex: 100,
            }}
            onChange={(e) => setEditingNode({ ...editingNode, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleInlineEditApply()
              } else if (e.key === 'Escape') {
                setEditingNode(null)
              }
            }}
            onBlur={handleInlineEditApply}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            autoFocus
          />
        )}

        {/* Resizing handles when selected */}
        {selected && !editingNode && (
          <>
            <div className="resize-handle resize-handle-se" onMouseDown={(e) => handleResizeMouseDown(e, 'se')} />
            <div className="resize-handle resize-handle-sw" onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} />
          </>
        )}
      </div>

      {error && (
        <div className="mermaid-error-toast">
          <strong>⚠️ Diagram Syntax Error</strong>
          <p>{error}</p>
        </div>
      )}

      {isEditing && (
        <div className="mermaid-editor-overlay" onMouseDown={(e) => e.stopPropagation()}>
          <div className="mermaid-editor-card">
            <div className="mermaid-editor-header">
              <span>📊 Edit Mermaid Diagram</span>
              <button className="close-overlay-btn" onClick={() => setIsEditing(false)}>✕</button>
            </div>

            {/* Template Selection dropdown */}
            <div className="mermaid-template-selector-group">
              <label className="mermaid-field-label">Insert Diagram Preset Template</label>
              <select 
                className="mermaid-template-select"
                onChange={(e) => {
                  const val = e.target.value
                  if (val) {
                    const template = MERMAID_TEMPLATES.find(t => t.name === val)
                    if (template) {
                      setTempCode(template.code)
                      if (typeof (window as any).logActivity === 'function') {
                        (window as any).logActivity(
                          `Loaded Template "${template.name}"`,
                          '📊',
                          'success',
                          `Successfully populated Mermaid editor canvas with default ${template.name} graph.`
                        )
                      }
                    }
                    e.target.value = '' // Reset selection
                  }
                }}
              >
                <option value="">-- Choose a template to load --</option>
                {MERMAID_TEMPLATES.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.icon} {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Theme Selector segmented control */}
            <div className="mermaid-theme-selector-group">
              <label className="mermaid-field-label">Chart Palette Theme</label>
              <div className="mermaid-theme-pills">
                {[
                  { name: 'default', label: 'Default 🔵', desc: 'Classic blue/green layout' },
                  { name: 'neutral', label: 'Neutral ⚪', desc: 'Sleek monochromatic print' },
                  { name: 'dark', label: 'Dark ⚫', desc: 'High-contrast slate dark' },
                  { name: 'forest', label: 'Forest 🟢', desc: 'Earthy green shades' },
                  { name: 'base', label: 'Base 🟣', desc: 'Customizable minimalist theme' },
                ].map((t) => (
                  <button
                    key={t.name}
                    className={`mermaid-theme-pill ${tempTheme === t.name ? 'active' : ''}`}
                    onClick={() => {
                      setTempTheme(t.name)
                      setTempCode(prev => updateStyleDefinitions(prev, t.name))
                    }}
                    title={t.desc}
                    type="button"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mermaid-code-field-wrapper">
              <label className="mermaid-field-label">Graph DSL Code</label>
              <textarea
                className="mermaid-code-input"
                value={tempCode}
                onChange={handleCodeChange}
                placeholder="e.g.&#10;graph TD&#10;  A[Start] --> B(End)"
                rows={8}
                autoFocus
              />
            </div>

            {/* Live syntax validation status indicator */}
            <div className={`mermaid-modal-validation-bar ${syntaxError ? 'invalid' : tempCode.trim() ? 'valid' : ''}`}>
              {isValidating ? (
                <span className="validation-text checking">🔄 Validating syntax...</span>
              ) : syntaxError ? (
                <span className="validation-text invalid">⚠️ {syntaxError.split('\n')[0]}</span>
              ) : tempCode.trim() ? (
                <span className="validation-text valid">✓ Syntax Valid</span>
              ) : (
                <span className="validation-text empty">Enter mermaid code to validate</span>
              )}
            </div>

            <div className="mermaid-editor-actions">
              <button className="editor-action-btn cancel" onClick={() => setIsEditing(false)}>Cancel</button>
              <button 
                className="editor-action-btn apply" 
                onClick={handleApplyChanges}
                disabled={!!syntaxError}
                style={{ opacity: syntaxError ? 0.6 : 1, cursor: syntaxError ? 'not-allowed' : 'pointer' }}
              >
                Update Diagram
              </button>
            </div>
          </div>
        </div>
      )}
    </NodeViewWrapper>
  )
}

// Register the custom Tiptap Node block
export const MermaidExtension = Node.create({
  name: 'mermaidCode',
  group: 'block',
  atom: true,
  priority: 1000,

  addAttributes() {
    return {
      code: {
        default: 'graph TD\n  A[Start] --> B(End)',
      },
      width: {
        default: 600,
      },
      theme: {
        default: 'neutral',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="mermaid"]',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return {}
          const element = dom as HTMLElement
          return { 
            code: element.getAttribute('data-code') || '',
            width: parseInt(element.getAttribute('data-width') || '600') || 600,
            theme: element.getAttribute('data-theme') || 'neutral',
          }
        }
      },
      {
        tag: 'pre',
        getAttrs: (dom) => {
          const element = dom as HTMLElement
          const codeEl = element.querySelector('code')
          if (codeEl && codeEl.classList.contains('language-mermaid')) {
            const rawCode = codeEl.textContent || ''
            
            // Try to extract theme from inline Mermaid init directive if present, e.g. %%{init: {'theme': 'neutral'}}%%
            let theme = 'neutral'
            const directiveMatch = rawCode.match(/^%%\s*\{\s*init\s*:\s*\{[\s\S]*?'theme'\s*:\s*'([^']+)'[\s\S]*?\}\s*\}\s*%%/i)
            if (directiveMatch) {
              theme = directiveMatch[1]
            }
            
            return {
              code: rawCode,
              width: 600,
              theme: theme,
            }
          }
          return false
        }
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-type': 'mermaid', 
      'data-code': HTMLAttributes.code,
      'data-width': String(HTMLAttributes.width || 600),
      'data-theme': HTMLAttributes.theme || 'neutral',
    })]
  },

  // Serialize the mermaid node to its standard Markdown code block syntax
  renderMarkdown: (node: any) => {
    const code = node.attrs?.code || ''
    // Ensure the code always ends with a newline to render cleanly inside fenced block
    const cleanCode = code.endsWith('\n') ? code : code + '\n'
    return `\`\`\`mermaid\n${cleanCode}\`\`\`\n\n`
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView)
  },
})
