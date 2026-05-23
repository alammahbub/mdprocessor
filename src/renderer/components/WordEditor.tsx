import React, { useEffect } from 'react'
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
import { MermaidExtension } from './MermaidNodeView'
import '../styles/a4-emulator.css'

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
  }
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
  onSelectionChange?: () => void
}

export const WordEditor: React.FC<WordEditorProps> = ({
  value,
  onChange,
  marginType,
  onEditorReady,
  onSelectionChange,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: false, // Disable default so we can register our custom alignment-preserving paragraph
        heading: false,   // Disable default so we can register our custom alignment-preserving heading
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
        types: ['heading', 'paragraph'],
      }),
      FontSize,
      Markdown,
      MermaidExtension,
    ],
    content: value,
    contentType: 'markdown' as any,
    onCreate: ({ editor }) => {
      if (onEditorReady) {
        onEditorReady(editor)
      }
    },
    onUpdate: ({ editor }) => {
      // Get standard Markdown string output directly
      const markdownOutput = (editor as any).getMarkdown()
      onChange(markdownOutput)
    },
    onSelectionUpdate: () => {
      if (onSelectionChange) {
        onSelectionChange()
      }
    },
    editorProps: {
      attributes: {
        class: 'novawriter-page-content focus:outline-none',
      },
    },
  })

  // Sync state changes from central markdown state
  useEffect(() => {
    if (!editor) return

    const currentMarkdown = (editor as any).getMarkdown()
    const normValue = normalizeMarkdown(value)
    const normCurrent = normalizeMarkdown(currentMarkdown)
    
    if (normValue !== normCurrent) {
      console.log('[WordEditor Sync] Mismatch detected! Resetting editor content to sync with source of truth.', {
        valueLength: value.length,
        currentMarkdownLength: currentMarkdown.length,
        normValue: normValue.slice(0, 100),
        normCurrent: normCurrent.slice(0, 100)
      })
      // Correct Tiptap signature: setContent(content, options)
      editor.commands.setContent(value, { emitUpdate: false } as any)
    } else {
      console.log('[WordEditor Sync] Content matches after normalization. No reset required.')
    }
  }, [value, editor])

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
