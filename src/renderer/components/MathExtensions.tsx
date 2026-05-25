import React, { useEffect, useRef, useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

/**
 * MathInline — renders inline LaTeX ( $...$ ) as a KaTeX span
 */
const MathInlineView: React.FC<NodeViewProps> = ({ node, updateAttributes, selected }) => {
  const containerRef = useRef<HTMLSpanElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(node.attrs.latex)
  const [renderError, setRenderError] = useState('')

  useEffect(() => {
    if (!containerRef.current || isEditing) return
    try {
      katex.render(node.attrs.latex, containerRef.current, {
        displayMode: false,
        throwOnError: false,
      })
      setRenderError('')
    } catch (err: any) {
      setRenderError(err?.message || 'KaTeX error')
    }
  }, [node.attrs.latex, isEditing])

  const handleDoubleClick = () => {
    setEditValue(node.attrs.latex)
    setIsEditing(true)
  }

  const handleBlur = () => {
    if (editValue !== node.attrs.latex) {
      updateAttributes({ latex: editValue })
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur()
    }
    if (e.key === 'Escape') {
      setEditValue(node.attrs.latex)
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <NodeViewWrapper as="span" className="math-inline-wrapper">
        <span className="math-inline-editing" contentEditable={false}>
          <input
            className="math-inline-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            style={{
              fontFamily: 'Consolas, monospace',
              fontSize: 'inherit',
              background: 'rgba(0,0,0,0.05)',
              border: '1px solid var(--primary-accent)',
              borderRadius: 3,
              padding: '0 4px',
              outline: 'none',
              color: 'inherit',
            }}
          />
        </span>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper as="span" className="math-inline-wrapper">
      <span
        ref={containerRef}
        className={`math-inline-render ${selected ? 'ProseMirror-selectednode' : ''}`}
        onClick={() => {}}
        onDoubleClick={handleDoubleClick}
        title={renderError || 'Double-click to edit LaTeX'}
        style={{ cursor: 'pointer', padding: '0 2px' }}
      />
    </NodeViewWrapper>
  )
}

export const MathInlineExtension = Node.create({
  name: 'mathInline',
  group: 'inline',
  atom: true,
  inline: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-math-inline') || '',
        renderHTML: (attrs) => {
          if (!attrs.latex) return {}
          return { 'data-math-inline': attrs.latex }
        },
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'span[data-math-inline]', getAttrs: (dom) => {
        const el = dom as HTMLElement
        return { latex: el.getAttribute('data-math-inline') || '' }
      }},
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-math-inline': HTMLAttributes.latex }), 0]
  },

  renderMarkdown: (node: any) => {
    const latex = node.attrs?.latex || ''
    const escaped = latex.replace(/"/g, '&quot;')
    return '<span data-math-inline="' + escaped + '"></span>'
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView)
  },
})

/**
 * MathBlock — renders block LaTeX ( $$...$$ ) as a centered KaTeX block
 */
const MathBlockView: React.FC<NodeViewProps> = ({ node, updateAttributes }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(node.attrs.latex)
  const [renderError, setRenderError] = useState('')

  useEffect(() => {
    if (!containerRef.current || isEditing) return
    try {
      katex.render(node.attrs.latex, containerRef.current, {
        displayMode: true,
        throwOnError: false,
      })
      setRenderError('')
    } catch (err: any) {
      setRenderError(err?.message || 'KaTeX error')
    }
  }, [node.attrs.latex, isEditing])

  const handleClick = () => {
    setEditValue(node.attrs.latex)
    setIsEditing(true)
  }

  const handleBlur = () => {
    if (editValue !== node.attrs.latex) {
      updateAttributes({ latex: editValue })
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleBlur()
    }
    if (e.key === 'Escape') {
      setEditValue(node.attrs.latex)
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <NodeViewWrapper className="math-block-wrapper">
        <div className="math-block-editor" contentEditable={false}>
          <div className="math-block-label">LaTeX Formula</div>
          <textarea
            className="math-block-textarea"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            rows={4}
            placeholder="E = mc^2"
          />
          <div className="math-block-actions">
            <button className="math-block-btn" onMouseDown={(e) => { e.preventDefault(); handleBlur() }}>
              ✓ Apply
            </button>
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="math-block-wrapper">
      <div
        className="math-block-render"
        onClick={handleClick}
        title="Click to edit formula"
        style={{ cursor: 'pointer' }}
      >
        {renderError && (
          <div className="math-block-error">
            <span>⚠️ {renderError}</span>
          </div>
        )}
        <div ref={containerRef} />
      </div>
    </NodeViewWrapper>
  )
}

export const MathBlockExtension = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-math-block') || '',
        renderHTML: (attrs) => {
          if (!attrs.latex) return {}
          return { 'data-math-block': attrs.latex }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-math-block]',
        getAttrs: (dom) => {
          const el = dom as HTMLElement
          return { latex: el.getAttribute('data-math-block') || '' }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-math-block': HTMLAttributes.latex })]
  },

  renderMarkdown: (node: any) => {
    const latex = node.attrs?.latex || ''
    const escaped = latex.replace(/"/g, '&quot;')
    return '<div data-math-block="' + escaped + '"></div>\n'
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView)
  },
})
