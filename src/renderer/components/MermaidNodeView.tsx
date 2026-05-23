import React, { useEffect, useState, useRef } from 'react'
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

export const MermaidNodeView: React.FC<NodeViewProps> = ({ node, updateAttributes }) => {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [tempCode, setTempCode] = useState<string>(node.attrs.code)
  const renderIdRef = useRef<string>(`mermaid-${Math.floor(Math.random() * 1000000)}`)

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

  return (
    <NodeViewWrapper className="mermaid-wrapper">
      <div 
        className={`mermaid-rendered-container ${isEditing ? 'blurred' : ''}`}
        onClick={() => setIsEditing(true)}
        title="Click to edit diagram"
      >
        {svg ? (
          <div className="mermaid-svg-frame" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="mermaid-placeholder">
            <span>📊 [Click to Create Mermaid Diagram]</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mermaid-error-toast">
          <strong>⚠️ Diagram Syntax Error</strong>
          <p>{error}</p>
        </div>
      )}

      {isEditing && (
        <div className="mermaid-editor-overlay">
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
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="mermaid"]',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return {}
          const element = dom as HTMLElement
          return { code: element.getAttribute('data-code') || '' }
        }
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid', 'data-code': HTMLAttributes.code }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView)
  },
})
