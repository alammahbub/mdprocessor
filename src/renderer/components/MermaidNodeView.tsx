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

export const MermaidNodeView: React.FC<NodeViewProps> = ({ node, updateAttributes, selected }) => {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [tempCode, setTempCode] = useState<string>(node.attrs.code)
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

  const compileDiagram = async (code: string) => {
    try {
      setError('')
      const cleanCode = code.trim()
      if (!cleanCode) {
        setSvg('')
        return
      }

      // Render the mermaid chart to SVG asynchronously
      const { svg: renderedSvg } = await mermaid.render(renderIdRef.current, cleanCode)
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

  // Compile when code attributes update
  useEffect(() => {
    compileDiagram(node.attrs.code)
  }, [node.attrs.code])

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTempCode(e.target.value)
  }

  const handleApplyChanges = () => {
    updateAttributes({ code: tempCode })
    setIsEditing(false)
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
    const updatedCode = updateMermaidNodeText(node.attrs.code, editingNode.id, editingNode.text)
    updateAttributes({ code: updatedCode })
    setTempCode(updatedCode)
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
      let parsedId = rawId.replace(/^flowchart-/, '')
      if (/-\d+$/.test(parsedId)) {
        parsedId = parsedId.replace(/-\d+$/, '')
      }

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
      updateAttributes({ width: Math.round(widthRef.current) })
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
              <span>Edit Mermaid Graph Code</span>
              <button className="close-overlay-btn" onClick={() => setIsEditing(false)}>✕</button>
            </div>
            <textarea
              className="mermaid-code-input"
              value={tempCode}
              onChange={handleCodeChange}
              placeholder="e.g.&#10;graph TD&#10;  A[Start] --> B(End)"
              rows={6}
              autoFocus
            />
            <div className="mermaid-editor-actions">
              <button className="editor-action-btn cancel" onClick={() => setIsEditing(false)}>Cancel</button>
              <button className="editor-action-btn apply" onClick={handleApplyChanges}>Update Diagram</button>
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

  addAttributes() {
    return {
      code: {
        default: 'graph TD\n  A[Start] --> B(End)',
      },
      width: {
        default: 600,
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
          }
        }
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-type': 'mermaid', 
      'data-code': HTMLAttributes.code,
      'data-width': String(HTMLAttributes.width || 600),
    }), 0]
  },

  // Serialize the mermaid node back to its HTML div form when saving as markdown
  renderMarkdown: (node: any) => {
    const code = node.attrs?.code || ''
    const escaped = code.replace(/"/g, '&quot;')
    const width = node.attrs?.width || 600
    return `<div data-type="mermaid" data-code="${escaped}" data-width="${width}"></div>\n`
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView)
  },
})
