import React, { useState, useRef, useCallback } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

export const TableNodeView: React.FC<NodeViewProps> = ({ node, selected }) => {
  const [resizingCol, setResizingCol] = useState<number | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)

  const parseCols = (): string[] => {
    const cols = node.attrs.cols
    if (Array.isArray(cols)) return cols
    if (typeof cols === 'string') {
      try { return JSON.parse(cols) } catch { return ['Header 1', 'Header 2'] }
    }
    return ['Header 1', 'Header 2']
  }

  const parseRows = (): string[][] => {
    const rows = node.attrs.rows
    if (Array.isArray(rows)) return rows
    if (typeof rows === 'string') {
      try { return JSON.parse(rows) } catch { return [['Cell A', 'Cell B']] }
    }
    return [['Cell A', 'Cell B']]
  }

  const parseColWidths = (): string[] => {
    const cw = node.attrs.colWidths
    if (Array.isArray(cw)) return cw
    if (typeof cw === 'string') {
      try { return JSON.parse(cw) } catch { return parseCols().map(() => 'auto') }
    }
    return parseCols().map(() => 'auto')
  }

  const cols = parseCols()
  const rows = parseRows()
  const colWidths = parseColWidths()

  const handleColResizeStart = useCallback((e: React.MouseEvent, colIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingCol(colIndex)

    const startX = e.clientX
    const table = tableRef.current
    if (!table) return

    const col = table.querySelectorAll('colgroup col')[colIndex] as HTMLTableColElement
    const startWidth = col?.offsetWidth || 80

    // Get all cells in this column across all rows
    const getColumnCells = () => {
      const cells: HTMLElement[] = []
      const rows_elements = table.querySelectorAll('tr')
      rows_elements.forEach((row) => {
        const cell = row.children[colIndex] as HTMLElement
        if (cell) cells.push(cell)
      })
      return cells
    }

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const newWidth = Math.max(40, startWidth + dx)
      if (col) {
        col.style.width = `${newWidth}px`
      }
      getColumnCells().forEach((cell) => {
        cell.style.width = `${newWidth}px`
      })
    }

    const handleMouseUp = () => {
      setResizingCol(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  return (
    <NodeViewWrapper className="table-nodeview-wrapper">
      <div className={`table-resize-container ${selected ? 'selected' : ''} ${resizingCol !== null ? 'resizing' : ''}`}>
        <table ref={tableRef} className="supermd-table" data-type="supermd-table">
          <colgroup>
            {cols.map((_: string, i: number) => (
              <col key={i} style={{ width: colWidths[i] || 'auto' }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {cols.map((col: string, i: number) => (
                <th key={i}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((rowData: string[], rowIndex: number) => (
              <tr key={rowIndex}>
                {rowData.map((cell: string, colIndex: number) => (
                  <td key={colIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Column resize handles */}
        {selected && cols.length > 0 && (
          <div className="col-resize-handles-row">
            {cols.map((_: string, i: number) => {
              if (i === cols.length - 1) return null // No handle after last column
              const pct = ((i + 1) / cols.length) * 100
              return (
                <div
                  key={i}
                  className={`col-resize-handle ${resizingCol === i ? 'active' : ''}`}
                  style={{ left: `${pct}%` }}
                  onMouseDown={(e) => handleColResizeStart(e, i)}
                />
              )
            })}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

// Register as a custom Tiptap Node
export const TableExtension = Node.create({
  name: 'supermdTable',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      cols: {
        default: ['Header 1', 'Header 2'],
        parseHTML: (element) => {
          const val = element.getAttribute('data-cols')
          if (val) {
            try { return JSON.parse(val) } catch { return ['Header 1', 'Header 2'] }
          }
          // Parse columns from standard table headers (th)
          const headers = Array.from(element.querySelectorAll('th')).map(th => th.textContent?.trim() || '')
          if (headers.length > 0) return headers
          // Fallback: look for td of the first tr
          const firstRowCells = Array.from(element.querySelectorAll('tr:first-child td')).map(td => td.textContent?.trim() || '')
          if (firstRowCells.length > 0) return firstRowCells
          return ['Header 1', 'Header 2']
        },
        renderHTML: (attributes) => {
          return { 'data-cols': JSON.stringify(attributes.cols || ['Header 1', 'Header 2']) }
        },
      },
      colWidths: {
        default: ['auto', 'auto'],
        parseHTML: (element) => {
          const val = element.getAttribute('data-colwidths')
          if (val) {
            try { return JSON.parse(val) } catch { return ['auto', 'auto'] }
          }
          const headersCount = element.querySelectorAll('th').length
          if (headersCount > 0) return Array(headersCount).fill('auto')
          const firstRowCellsCount = element.querySelectorAll('tr:first-child td').length
          if (firstRowCellsCount > 0) return Array(firstRowCellsCount).fill('auto')
          return ['auto', 'auto']
        },
        renderHTML: (attributes) => {
          return { 'data-colwidths': JSON.stringify(attributes.colWidths || ['auto', 'auto']) }
        },
      },
      rows: {
        default: [['Cell A', 'Cell B'], ['Cell C', 'Cell D']],
        parseHTML: (element) => {
          const val = element.getAttribute('data-rows')
          if (val) {
            try { return JSON.parse(val) } catch { return [['Cell A', 'Cell B']] }
          }
          // Parse rows from standard table rows (tbody tr or just tr)
          const rowsList: string[][] = []
          const trs = Array.from(element.querySelectorAll('tr'))
          const hasHeaders = element.querySelectorAll('th').length > 0
          
          trs.forEach((tr, index) => {
            if (hasHeaders && index === 0) return // Skip header row
            const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent?.trim() || '')
            if (cells.length > 0) {
              rowsList.push(cells)
            }
          })
          
          if (rowsList.length > 0) return rowsList
          return [['Cell A', 'Cell B']]
        },
        renderHTML: (attributes) => {
          return { 'data-rows': JSON.stringify(attributes.rows || [['Cell A', 'Cell B']]) }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'table[data-type="supermd-table"]',
      },
      {
        tag: 'table',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const cols = Array.isArray(HTMLAttributes.cols)
      ? HTMLAttributes.cols
      : ['Header 1', 'Header 2']
    const rows = Array.isArray(HTMLAttributes.rows)
      ? HTMLAttributes.rows
      : [['Cell A', 'Cell B']]
    const colWidths = Array.isArray(HTMLAttributes.colWidths)
      ? HTMLAttributes.colWidths
      : cols.map(() => 'auto')

    return [
      'table',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'supermd-table',
        'data-cols': JSON.stringify(cols),
        'data-rows': JSON.stringify(rows),
        'data-colwidths': JSON.stringify(colWidths),
        style: 'width: 100%; border-collapse: collapse;',
      }),
      ['colgroup', {}, ...cols.map((_, i) => ['col', { style: `width: ${colWidths[i] || 'auto'}` }]) as any],
      ['thead', {}, ['tr', {}, ...cols.map((col) => ['th', { style: 'background: var(--hover-bg, rgba(0,0,0,0.04)); font-weight: 600; border: 1px solid #d2d0ce; padding: 8px 10px; text-align: left;' }, col]) as any]],
      ['tbody', {}, ...rows.map((row: string[]) => ['tr', {}, ...row.map((cell: string) => ['td', { style: 'border: 1px solid #d2d0ce; padding: 8px 10px;' }, cell]) as any]) as any],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TableNodeView)
  },
})
