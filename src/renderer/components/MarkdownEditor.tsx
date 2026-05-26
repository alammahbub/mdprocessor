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
  onSelectionChange?: (anchor: number, head: number) => void
  selection?: { anchor: number; head: number } | null
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  showLineNumbers,
  showInvisibles,
  onSelectionChange,
  selection,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const isUpdatingRef = useRef<boolean>(false)
  const isExternalSelectionUpdateRef = useRef<boolean>(false)

  // Initialize CodeMirror 6
  useEffect(() => {
    if (!containerRef.current) return

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isUpdatingRef.current) {
        const docString = update.state.doc.toString()
        onChange(docString)
      }
      
      // Capture selection updates from CodeMirror in real-time
      if (update.selectionSet) {
        if (isExternalSelectionUpdateRef.current) {
          isExternalSelectionUpdateRef.current = false
          return
        }
        if (!isUpdatingRef.current) {
          const mainSelection = update.state.selection.main
          onSelectionChange?.(mainSelection.anchor, mainSelection.head)
        }
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

  // Sync selection updates from ProseMirror into CodeMirror
  useEffect(() => {
    const view = viewRef.current
    if (!view || !selection) return

    const { anchor, head } = selection
    const docLength = view.state.doc.length
    
    const safeAnchor = Math.min(docLength, Math.max(0, anchor))
    const safeHead = Math.min(docLength, Math.max(0, head))

    // Prevent redundant cursor dispatch loops
    const currentSel = view.state.selection.main
    if (currentSel.anchor === safeAnchor && currentSel.head === safeHead) return

    isExternalSelectionUpdateRef.current = true
    view.dispatch({
      selection: { anchor: safeAnchor, head: safeHead },
      scrollIntoView: true,
    })
    isExternalSelectionUpdateRef.current = false
  }, [selection])

  return (
    <div 
      ref={containerRef} 
      className="novawriter-markdown-editor-container"
    />
  )
}
