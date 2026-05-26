import React, { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Underline } from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { FontFamily } from '@tiptap/extension-font-family'
import { TextAlign } from '@tiptap/extension-text-align'
import Paragraph from '@tiptap/extension-paragraph'
import Heading from '@tiptap/extension-heading'
import { Extension } from '@tiptap/core'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import LinkExtension from '@tiptap/extension-link'
import DOMPurify from 'dompurify'
import Typography from '@tiptap/extension-typography'
import { MermaidExtension } from './MermaidNodeView'
import { ImageExtension } from './ImageNodeView'
import { MathInlineExtension, MathBlockExtension } from './MathExtensions'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import '../styles/a4-emulator.css'
import '../styles/image-resizer.css'

// Custom Tiptap extension to draw a synchronized blinking caret when this editor is blurred
export const SynchronizedCaret = Extension.create({
  name: 'synchronizedCaret',
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('synchronizedCaret'),
        props: {
          decorations(state) {
            const isFocused = editor.isFocused
            if (!isFocused && state.selection.empty) {
              const span = document.createElement('span')
              span.className = 'novawriter-synchronized-caret'
              return DecorationSet.create(state.doc, [
                Decoration.widget(state.selection.from, span)
              ])
            }
            return DecorationSet.empty
          }
        }
      })
    ]
  }
})

// Custom Tiptap extension to manage font size (renders as inline styles in standard span tags)
export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/px|pt/g, '') || null,
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {}
              }
              return {
                style: `font-size: ${attributes.fontSize}pt`,
              }
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) => {
        return chain()
          .setMark('textStyle', { fontSize })
          .run()
      },
      unsetFontSize: () => ({ chain }: any) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .run()
      },
    } as any
  },
})

// Custom TextStyle extension to preserve inline style properties as HTML spans
export const CustomTextStyle = TextStyle.extend({
  renderMarkdown: (node: any, helpers: any) => {
    const content = helpers.renderChildren(node.content || [])
    const attrs = node.attrs
    const styles = []
    if (attrs.color) styles.push(`color: ${attrs.color}`)
    if (attrs.fontSize) styles.push(`font-size: ${attrs.fontSize}pt`)
    if (attrs.fontFamily) styles.push(`font-family: ${attrs.fontFamily}`)
    
    if (styles.length > 0) {
      return `<span style="${styles.join('; ')}">${content}</span>`
    }
    return content
  }
} as any)

// Custom Highlight extension to preserve background colors as styled mark tags
export const CustomHighlight = Highlight.extend({
  renderMarkdown: (node: any, helpers: any) => {
    const content = helpers.renderChildren(node.content || [])
    const color = node.attrs.color
    if (color) {
      return `<mark style="background-color: ${color}">${content}</mark>`
    }
    return `<mark>${content}</mark>`
  }
} as any)

// Custom Paragraph extension to preserve alignments as aligned paragraph tags
export const CustomParagraph = Paragraph.extend({
  renderMarkdown: (node: any, helpers: any) => {
    const content = helpers.renderChildren(node.content || [])
    const align = node.attrs.textAlign
    if (align && align !== 'left') {
      return `<p style="text-align: ${align}">${content}</p>\n\n`
    }
    return `${content}\n\n`
  }
} as any)

// Custom Heading extension to preserve alignments as aligned heading tags
// Also generates heading IDs for anchor links
export const CustomHeading = Heading.extend({
  renderMarkdown: (node: any, helpers: any) => {
    const content = helpers.renderChildren(node.content || [])
    const align = node.attrs.textAlign
    const level = node.attrs.level
    if (align && align !== 'left') {
      return `<h${level} style="text-align: ${align}">${content}</h${level}>\n\n`
    }
    const hashes = '#'.repeat(level)
    return `${hashes} ${content}\n\n`
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          return element.getAttribute('id') || 
            element.textContent?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || null
        },
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.id) return {}
          return { id: attributes.id }
        },
      },
    }
  },
} as any)

// Markdown utilities to normalize formatting differences (CRLF vs LF) and prevent cursor reset loops
const normalizeMarkdown = (str: string) => {
  return str.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim()
}

interface WordEditorProps {
  value: string
  onChange: (val: string) => void
  marginType: 'normal' | 'narrow' | 'wide'
  isFocused: boolean
  onEditorReady?: (editor: any) => void
  onSelectionChange?: (anchor: number, head: number) => void
  selection?: { anchor: number; head: number } | null
}

export const WordEditor: React.FC<WordEditorProps> = ({
  value,
  onChange,
  marginType,
  onEditorReady,
  onSelectionChange,
  selection,
}) => {
  // Track whether the latest value change came from this editor's own onUpdate.
  const isLocalUpdateRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: false,
        heading: false,
        codeBlock: {
          HTMLAttributes: {
            class: 'novawriter-code-block',
          },
        },
      }),
      CustomParagraph,
      CustomHeading,
      Underline,
      CustomTextStyle,
      Color,
      CustomHighlight.configure({
        multicolor: true,
      }),
      FontFamily,
      TextAlign.configure({
        types: ['heading', 'paragraph', 'tableCell', 'tableHeader', 'listItem'],
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: 'novawriter-link',
        },
      }),
      Typography,
      FontSize,
      Markdown,
      MathInlineExtension,
      MathBlockExtension,
      MermaidExtension,
      ImageExtension,
      SynchronizedCaret,
    ],
    content: value,
    contentType: 'markdown' as any,
    onCreate: ({ editor }) => {
      if (onEditorReady) {
        onEditorReady(editor)
      }
    },
    onUpdate: ({ editor }) => {
      try {
        const markdownOutput = (editor as any).getMarkdown()
        isLocalUpdateRef.current = true
        onChange(markdownOutput)
      } catch (err) {
        console.error('[WordEditor] getMarkdown() error:', err)
      }
    },
    onSelectionUpdate: ({ editor }) => {
      if (onSelectionChange) {
        onSelectionChange(editor.state.selection.anchor, editor.state.selection.head)
      }
    },
    editorProps: {
      attributes: {
        class: 'novawriter-page-content focus:outline-none',
      },
      // Sanitize pasted HTML content using DOMPurify
      transformPastedHTML: (html) => {
        return DOMPurify.sanitize(html, {
          ALLOWED_TAGS: [
            'p', 'br', 'b', 'i', 'u', 's', 'em', 'strong', 'a', 'img',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
            'blockquote', 'pre', 'code', 'hr', 'table', 'thead', 'tbody',
            'tr', 'th', 'td', 'col', 'colgroup', 'span', 'div', 'mark',
            'sub', 'sup', 'dl', 'dt', 'dd', 'figure', 'figcaption',
            'ins', 'span',
          ],
          ALLOWED_ATTR: [
            'href', 'src', 'alt', 'width', 'height', 'style', 'class',
            'id', 'title', 'target', 'rel', 'data-type', 'data-code',
            'data-cols', 'data-rows', 'data-colwidths',
            'data-math-inline', 'data-math-block', 'data-theme',
          ],
          ALLOW_DATA_ATTR: true,
        })
      },
    },
  })

  // Sync the active editor instance to the parent component on mount, update, and unmount.
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      onEditorReady?.(editor)
    }
  }, [editor, onEditorReady])

  // Sync from external source (CodeMirror markdown editor) into ProseMirror.
  // Skip when the change originated from this editor's own onUpdate.
  useEffect(() => {
    if (!editor) return

    if (isLocalUpdateRef.current) {
      isLocalUpdateRef.current = false
      return
    }

    try {
      const currentMarkdown = (editor as any).getMarkdown()
      if (normalizeMarkdown(value) !== normalizeMarkdown(currentMarkdown)) {
        if (!value || value.trim() === '') {
          editor.commands.clearContent(false)
          return
        }
        editor.commands.setContent(value, { emitUpdate: false, contentType: 'markdown' } as any)
      }
    } catch {
      // Empty editor or serialization error — safe to ignore
    }
  }, [value, editor])

  // Sync selection from external source (CodeMirror markdown editor) into Tiptap
  useEffect(() => {
    if (!editor || !selection || editor.isDestroyed) return

    const { anchor, head } = selection
    const docSize = editor.state.doc.content.size
    const safeAnchor = Math.min(docSize, Math.max(1, anchor))
    const safeHead = Math.min(docSize, Math.max(1, head))

    // Compare with current Tiptap selection to avoid feedback loops
    const currentSel = editor.state.selection
    if (currentSel.anchor === safeAnchor && currentSel.head === safeHead) return

    isLocalUpdateRef.current = true
    editor.chain().setTextSelection({ from: safeAnchor, to: safeHead }).scrollIntoView().run()
  }, [selection, editor])

  // Get margin class name
  const getMarginClass = () => {
    switch (marginType) {
      case 'narrow':
        return 'margin-narrow'
      case 'wide':
        return 'margin-wide'
      default:
        return 'margin-normal'
    }
  }

  return (
    <div className="novawriter-canvas-scroller">
      <div className="novawriter-canvas">
        <div className={`novawriter-page ${getMarginClass()}`}>
          {/* Header placeholder */}
          <div className="novawriter-page-header">
            <span>NovaWriter Document</span>
            <span className="page-number-marker">Page 1</span>
          </div>

          {/* Core ProseMirror editor body */}
          <EditorContent editor={editor} />

          {/* Footer placeholder */}
          <div className="novawriter-page-footer">
            <span>Saved locally as .md</span>
            <span>NovaWriter 2026</span>
          </div>
        </div>
      </div>
    </div>
  )
}
