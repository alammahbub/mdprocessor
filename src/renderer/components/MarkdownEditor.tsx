import React, { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers, highlightActiveLineGutter, highlightActiveLine, keymap, drawSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { foldGutter, foldKeymap, bracketMatching } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'

interface MarkdownEditorProps {
  value: string
  onChange: (val: string) => void
  showLineNumbers: boolean
  showInvisibles: boolean
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  showLineNumbers,
  showInvisibles,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const isUpdatingRef = useRef<boolean>(false)

  // Initialize CodeMirror 6
  useEffect(() => {
    if (!containerRef.current) return

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isUpdatingRef.current) {
        const docString = update.state.doc.toString()
        onChange(docString)
      }
    })

    // Custom invisible characters styling if activated
    const invisibleTheme = EditorView.theme({
      '&.cm-editor': {
        height: '100%',
        fontSize: '14px',
        fontFamily: 'Consolas, Monaco, "Andale Mono", monospace',
      },
      '.cm-scroller': {
        overflow: 'auto',
      },
    })

    const extensions = [
      history(),
      drawSelection(),
      bracketMatching(),
      markdown(),
      oneDark,
      invisibleTheme,
      updateListener,
      keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),
    ]

    if (showLineNumbers) {
      extensions.push(lineNumbers())
      extensions.push(foldGutter())
      extensions.push(highlightActiveLineGutter())
      extensions.push(highlightActiveLine())
    }

    if (showInvisibles) {
      extensions.push(drawSelection())
      // Draw standard invisible indicator markers
      extensions.push(
        EditorView.theme({
          '.cm-specialChar': {
            color: '#5c6370',
            '&:after': { content: '"·"' },
          },
        })
      )
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
    }
  }, [showLineNumbers, showInvisibles])

  // Sync value updates from parent state (e.g. from Word Mode editing)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const currentDoc = view.state.doc.toString()
    if (value !== currentDoc) {
      isUpdatingRef.current = true
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      })
      isUpdatingRef.current = false
    }
  }, [value])

  return (
    <div 
      ref={containerRef} 
      className="novawriter-markdown-editor-container"
    />
  )
}
