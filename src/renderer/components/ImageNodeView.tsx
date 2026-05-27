import React, { useState, useRef, useCallback, useEffect } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

export const ImageNodeView: React.FC<NodeViewProps> = ({ node, updateAttributes, selected }) => {
  const [isResizing, setIsResizing] = useState(false)
  const [width, setWidth] = useState(node.attrs.width || 400)
  const [aspectRatio, setAspectRatio] = useState(1)
  const imgRef = useRef<HTMLImageElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const widthRef = useRef(width)

  // Keep widthRef in sync with state
  useEffect(() => {
    widthRef.current = width
  }, [width])

  const handleMouseDown = useCallback((e: React.MouseEvent, corner: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    startXRef.current = e.clientX
    startWidthRef.current = widthRef.current

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startXRef.current
      let newWidth: number

      if (corner === 'se') {
        newWidth = Math.max(100, startWidthRef.current + dx)
      } else if (corner === 'sw') {
        newWidth = Math.max(100, startWidthRef.current - dx)
      } else {
        newWidth = Math.max(100, startWidthRef.current + dx)
      }

      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      // Use the ref to get the live width value, not the stale closure
      updateAttributes({ width: Math.round(widthRef.current) })
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [updateAttributes])

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setAspectRatio(imgRef.current.naturalWidth / imgRef.current.naturalHeight)
    }
  }, [node.attrs.src])

  const handleImgLoad = () => {
    if (imgRef.current) {
      setAspectRatio(imgRef.current.naturalWidth / imgRef.current.naturalHeight)
    }
  }

  const displayWidth = width
  const displayHeight = displayWidth / aspectRatio

  return (
    <NodeViewWrapper className="image-nodeview-wrapper" contentEditable={false}>
      <div className={`image-resize-container ${selected ? 'selected' : ''} ${isResizing ? 'resizing' : ''}`}
        style={{ width: displayWidth, height: displayHeight }}
      >
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          width={displayWidth}
          height={displayHeight}
          onLoad={handleImgLoad}
          draggable={false}
          className="image-nodeview-img"
          style={{ width: displayWidth, height: displayHeight, objectFit: 'contain' }}
        />

        {/* Corner resize handles */}
        {selected && (
          <>
            <div className="resize-handle resize-handle-se" onMouseDown={(e) => handleMouseDown(e, 'se')} />
            <div className="resize-handle resize-handle-sw" onMouseDown={(e) => handleMouseDown(e, 'sw')} />
            <div className="resize-handle resize-handle-ne" onMouseDown={(e) => handleMouseDown(e, 'ne')} />
            <div className="resize-handle resize-handle-nw" onMouseDown={(e) => handleMouseDown(e, 'nw')} />
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

// Register as a custom Tiptap Node
export const ImageExtension = Node.create({
  name: 'supermdImage',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: '',
      },
      alt: {
        default: '',
      },
      width: {
        default: 400,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return {}
          const element = dom as HTMLImageElement
          return {
            src: element.getAttribute('src') || '',
            alt: element.getAttribute('alt') || '',
            width: parseInt(element.getAttribute('width') || '400') || 400,
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const width = HTMLAttributes.width || 400
    return [
      'img',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'supermd-image',
        width: String(width),
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },
})
