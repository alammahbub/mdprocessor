import React, { useState, useEffect, useRef } from 'react'
import '../styles/ribbon.css'

interface DropdownOption {
  value: string
  label: string
  style?: React.CSSProperties
}

interface RibbonDropdownProps {
  value: string
  options: DropdownOption[]
  onChange: (val: string) => void
  title: string
  className?: string
  style?: React.CSSProperties
  triggerStyle?: React.CSSProperties
  isColorPicker?: boolean
}

const RibbonDropdown: React.FC<RibbonDropdownProps> = ({
  value,
  options,
  onChange,
  title,
  className = '',
  style = {},
  triggerStyle = {},
  isColorPicker = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const selectedOption = options.find(o => o.value === value)

  return (
    <div className={`ribbon-dropdown-container ${className}`} style={style} ref={dropdownRef}>
      <button
        type="button"
        className={`ribbon-dropdown-trigger ${isOpen ? 'open' : ''} ${isColorPicker ? 'color-picker-trigger' : ''}`}
        style={triggerStyle}
        onMouseDown={(e) => {
          e.preventDefault() // Crucial! Keeps editor selection active!
          setIsOpen(!isOpen)
        }}
        title={title}
      >
        <span className="dropdown-trigger-text">
          {isColorPicker ? (
            <span className="color-indicator-char" style={{ borderBottom: `3px solid ${value}` }}>A</span>
          ) : (
            selectedOption?.label || value
          )}
        </span>
        <span className="dropdown-arrow">▼</span>
      </button>
      {isOpen && (
        <div className="ribbon-dropdown-menu">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`ribbon-dropdown-item ${opt.value === value ? 'selected' : ''}`}
              style={opt.style}
              onMouseDown={(e) => {
                e.preventDefault() // Crucial! Keeps editor selection active!
                onChange(opt.value)
                setIsOpen(false)
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface RibbonToolbarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  editor?: any
  selectionTick?: number
  onBold: () => void
  onItalic: () => void
  onUnderline: () => void
  onStrike: () => void
  onParagraph: () => void
  onHeading: (level: 1 | 2 | 3) => void
  onBlockquote: () => void
  onHorizontalRule: () => void
  onFontFamily: (family: string) => void
  onFontSize: (size: string) => void
  onTextColor: (color: string) => void
  onHighlightColor: (color: string) => void
  onAlignText: (alignment: 'left' | 'center' | 'right' | 'justify') => void
  marginType: 'normal' | 'narrow' | 'wide'
  setMarginType: (type: 'normal' | 'narrow' | 'wide') => void
  viewMode: 'word' | 'markdown' | 'split'
  setViewMode: (mode: 'word' | 'markdown' | 'split') => void
  isDarkMode: boolean
  setIsDarkMode: (dark: boolean) => void
  onInsertTable: () => void
  onInsertMermaid: () => void
  onSave: () => void
  onOpenFile: () => void
  onNewFile: () => void
  onUndo: () => void
  onRedo: () => void
  onCut: () => void
  onCopy: () => void
  onPaste: () => void
  onExportPDF: () => void
  filePath: string | null
}

export const RibbonToolbar: React.FC<RibbonToolbarProps> = ({
  activeTab,
  setActiveTab,
  editor,
  onBold,
  onItalic,
  onUnderline,
  onStrike,
  onParagraph,
  onHeading,
  onBlockquote,
  onHorizontalRule,
  onFontFamily,
  onFontSize,
  onTextColor,
  onHighlightColor,
  onAlignText,
  marginType,
  setMarginType,
  viewMode,
  setViewMode,
  isDarkMode,
  setIsDarkMode,
  onInsertTable,
  onInsertMermaid,
  onSave,
  onOpenFile,
  onNewFile,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onExportPDF,
  filePath,
}) => {
  const tabs = ['Home', 'Insert', 'Layout', 'View']

  // Retrieve active attributes from the live Tiptap ProseMirror instance safely
  const activeEditor = (editor && !editor.isDestroyed) ? editor : null

  const isBold = activeEditor?.isActive('bold') || false
  const isItalic = activeEditor?.isActive('italic') || false
  const isUnderline = activeEditor?.isActive('underline') || false
  const isStrike = activeEditor?.isActive('strike') || false

  const activeFontFamily = activeEditor?.getAttributes('textStyle').fontFamily || 'Arial'
  const activeFontSize = activeEditor?.getAttributes('textStyle').fontSize || '11'
  const activeColor = activeEditor?.getAttributes('textStyle').color || '#323130'
  const activeHighlightColor = activeEditor?.getAttributes('highlight').color || 'transparent'

  const isLeftAlign = activeEditor?.isActive({ textAlign: 'left' }) || (!activeEditor?.isActive({ textAlign: 'center' }) && !activeEditor?.isActive({ textAlign: 'right' }) && !activeEditor?.isActive({ textAlign: 'justify' }))
  const isCenterAlign = activeEditor?.isActive({ textAlign: 'center' }) || false
  const isRightAlign = activeEditor?.isActive({ textAlign: 'right' }) || false
  const isJustifyAlign = activeEditor?.isActive({ textAlign: 'justify' }) || false

  return (
    <div className="ribbon-container">
      {/* Top Application Title Bar */}
      <div className="ribbon-title-bar">
        <div className="ribbon-title-left">
          <span className="app-logo">📄</span>
          <span className="app-title">NovaWriter - {filePath ? filePath.split(/[\\/]/).pop() : 'Untitled.md'}</span>
        </div>
        <div className="ribbon-title-actions">
          {/* File Operations */}
          <button className="quick-action-btn" onClick={onNewFile} title="Create New Document (Ctrl+N)">📄 New</button>
          <button className="quick-action-btn" onClick={onOpenFile} title="Open File (Ctrl+O)">📂 Open</button>
          <button className="quick-action-btn primary" onClick={onSave} title="Save File (Ctrl+S)">💾 Save</button>
          <button className="quick-action-btn" onClick={onExportPDF} title="Export to PDF">📥 Export PDF</button>
          
          <span className="ribbon-title-divider">|</span>
          
          {/* Quick Workspace View Toggles */}
          <div className="quick-view-toggle-group">
            <button 
              className={`quick-view-btn ${viewMode === 'word' ? 'active' : ''}`}
              onClick={() => setViewMode('word')}
              title="Word Mode (Rich Formatting Edit Canvas)"
            >
              📄 Word
            </button>
            <button 
              className={`quick-view-btn ${viewMode === 'split' ? 'active' : ''}`}
              onClick={() => setViewMode('split')}
              title="Split View (Side-by-Side Sync View)"
            >
              🥞 Split
            </button>
            <button 
              className={`quick-view-btn ${viewMode === 'markdown' ? 'active' : ''}`}
              onClick={() => setViewMode('markdown')}
              title="Markdown Mode (Raw Code Editor)"
            >
              💻 Code
            </button>
          </div>
        </div>
      </div>

      {/* Ribbon Navigation Tabs */}
      <div className="ribbon-tabs-nav">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`ribbon-tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Active Tab Panel Body */}
      <div className="ribbon-tab-panel">
        {activeTab === 'Home' && (
          <div className="ribbon-groups-container">
            {/* Clipboard group */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">Clipboard</div>
              <div className="ribbon-group-row">
                <button className="ribbon-tool-btn text-btn" onMouseDown={(e) => { e.preventDefault(); onCut(); }} title="Cut Selection (Ctrl+X)">Cut</button>
                <button className="ribbon-tool-btn text-btn" onMouseDown={(e) => { e.preventDefault(); onCopy(); }} title="Copy Selection (Ctrl+C)">Copy</button>
                <button className="ribbon-tool-btn text-btn" onMouseDown={(e) => { e.preventDefault(); onPaste(); }} title="Paste Clipboard (Ctrl+V)">Paste</button>
              </div>
            </div>

            {/* Undo/Redo group */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">Undo & Redo</div>
              <div className="ribbon-group-row">
                <button className="ribbon-tool-btn" onMouseDown={(e) => { e.preventDefault(); onUndo(); }} title="Undo Last Change (Ctrl+Z)" style={{ fontSize: '16px' }}>↶</button>
                <button className="ribbon-tool-btn" onMouseDown={(e) => { e.preventDefault(); onRedo(); }} title="Redo Last Change (Ctrl+Y)" style={{ fontSize: '16px' }}>↷</button>
              </div>
            </div>

            {/* Font & Formatting controls */}
            <div className="ribbon-group" style={{ height: 'auto', minWidth: '220px' }}>
              <div className="ribbon-group-title">Font</div>
              
              {/* Dropdowns row */}
              <div className="ribbon-group-row" style={{ marginBottom: '4px' }}>
                <RibbonDropdown
                  value={activeFontFamily}
                  onChange={onFontFamily}
                  title="Font Family"
                  className="font-family-dropdown"
                  options={[
                    { value: 'Arial', label: 'Arial' },
                    { value: 'Segoe UI', label: 'Segoe UI' },
                    { value: 'Georgia', label: 'Georgia' },
                    { value: 'Courier New', label: 'Courier New' },
                    { value: 'Times New Roman', label: 'Times New Roman' },
                    { value: 'Verdana', label: 'Verdana' },
                    { value: 'Trebuchet MS', label: 'Trebuchet MS' },
                    { value: 'Arial Black', label: 'Arial Black' },
                  ]}
                />

                <RibbonDropdown
                  value={activeFontSize}
                  onChange={onFontSize}
                  title="Font Size (pt)"
                  className="font-size-dropdown"
                  options={[
                    { value: '8', label: '8' },
                    { value: '9', label: '9' },
                    { value: '10', label: '10' },
                    { value: '11', label: '11' },
                    { value: '12', label: '12' },
                    { value: '14', label: '14' },
                    { value: '16', label: '16' },
                    { value: '18', label: '18' },
                    { value: '20', label: '20' },
                    { value: '24', label: '24' },
                    { value: '28', label: '28' },
                    { value: '36', label: '36' },
                    { value: '48', label: '48' },
                    { value: '72', label: '72' },
                  ]}
                />
              </div>

              {/* Formatting and color buttons row */}
              <div className="ribbon-group-row">
                <button className={`ribbon-tool-btn font-bold ${isBold ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); onBold(); }} title="Bold (Ctrl+B)">B</button>
                <button className={`ribbon-tool-btn font-italic ${isItalic ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); onItalic(); }} title="Italic (Ctrl+I)">I</button>
                <button className={`ribbon-tool-btn font-underline ${isUnderline ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); onUnderline(); }} title="Underline (Ctrl+U)">U</button>
                <button className={`ribbon-tool-btn font-strike ${isStrike ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); onStrike(); }} title="Strikethrough">S</button>
                
                <span className="ribbon-tool-divider"></span>

                {/* Font Color select picker */}
                <div className="color-tool-wrapper">
                  <RibbonDropdown
                    value={activeColor}
                    onChange={onTextColor}
                    title="Text Color"
                    isColorPicker={true}
                    options={[
                      { value: '#323130', label: 'Black', style: { color: '#323130' } },
                      { value: '#2b579a', label: 'Blue', style: { color: '#2b579a' } },
                      { value: '#0078d4', label: 'Cyan', style: { color: '#0078d4' } },
                      { value: '#a80000', label: 'Red', style: { color: '#a80000' } },
                      { value: '#107c41', label: 'Green', style: { color: '#107c41' } },
                      { value: '#d83b01', label: 'Orange', style: { color: '#d83b01' } },
                      { value: '#e3008c', label: 'Pink', style: { color: '#e3008c' } },
                      { value: '#7a24db', label: 'Purple', style: { color: '#7a24db' } },
                      { value: '#5c6370', label: 'Gray', style: { color: '#5c6370' } },
                    ]}
                  />
                </div>

                {/* Highlight Color picker */}
                <div className="color-tool-wrapper">
                  <RibbonDropdown
                    value={activeHighlightColor}
                    onChange={onHighlightColor}
                    title="Highlight Color"
                    className="highlight-dropdown"
                    triggerStyle={{
                      backgroundColor: activeHighlightColor === 'transparent' ? 'transparent' : activeHighlightColor,
                      border: '1px solid #d2d0ce',
                    }}
                    options={[
                      { value: 'transparent', label: 'None' },
                      { value: '#ffff00', label: 'Yellow', style: { backgroundColor: '#ffff00' } },
                      { value: '#00ff00', label: 'Green', style: { backgroundColor: '#00ff00' } },
                      { value: '#00ffff', label: 'Cyan', style: { backgroundColor: '#00ffff' } },
                      { value: '#ff00ff', label: 'Pink', style: { backgroundColor: '#ff00ff' } },
                      { value: '#ff0000', label: 'Red', style: { backgroundColor: '#ff0000', color: '#ffffff' } },
                      { value: '#b5f5ec', label: 'Soft Mint', style: { backgroundColor: '#b5f5ec' } },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Paragraph Alignment controls */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">Paragraph</div>
              <div className="ribbon-group-row" style={{ height: '100%', alignItems: 'center' }}>
                <button className={`ribbon-tool-btn ${isLeftAlign ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); onAlignText('left'); }} title="Align Left">
                  ⫷
                </button>
                <button className={`ribbon-tool-btn ${isCenterAlign ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); onAlignText('center'); }} title="Align Center">
                  ☷
                </button>
                <button className={`ribbon-tool-btn ${isRightAlign ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); onAlignText('right'); }} title="Align Right">
                  ⫸
                </button>
                <button className={`ribbon-tool-btn ${isJustifyAlign ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); onAlignText('justify'); }} title="Justify">
                  ☰
                </button>
              </div>
            </div>

            {/* Quick Paragraph Style Controls */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">Styles</div>
              <div className="ribbon-group-row" style={{ height: '100%', alignItems: 'center' }}>
                <button className="ribbon-tool-btn text-btn" onMouseDown={(e) => { e.preventDefault(); onParagraph(); }}>Normal Text</button>
                <button className="ribbon-tool-btn text-btn" onMouseDown={(e) => { e.preventDefault(); onHeading(1); }}>H1</button>
                <button className="ribbon-tool-btn text-btn" onMouseDown={(e) => { e.preventDefault(); onHeading(2); }}>H2</button>
                <button className="ribbon-tool-btn text-btn" onMouseDown={(e) => { e.preventDefault(); onHeading(3); }}>H3</button>
              </div>
            </div>

            {/* Structure markup styles */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">Structure</div>
              <div className="ribbon-group-row" style={{ height: '100%', alignItems: 'center' }}>
                <button className="ribbon-tool-btn text-btn" onMouseDown={(e) => { e.preventDefault(); onBlockquote(); }}>Blockquote</button>
                <button className="ribbon-tool-btn text-btn" onMouseDown={(e) => { e.preventDefault(); onHorizontalRule(); }}>Divider Line</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Insert' && (
          <div className="ribbon-groups-container">
            {/* Tables group */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">Tables</div>
              <div className="ribbon-group-row">
                <button className="ribbon-tool-btn insert-block-btn" onMouseDown={(e) => { e.preventDefault(); onInsertTable(); }} title="Insert Table Grid">
                  <span className="btn-icon">📅</span>
                  <span className="btn-text">Insert Table</span>
                </button>
              </div>
            </div>

            {/* Visual illustrations & diagrams */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">Illustrations & Charts</div>
              <div className="ribbon-group-row">
                <button className="ribbon-tool-btn insert-block-btn" onMouseDown={(e) => { e.preventDefault(); onInsertMermaid(); }} title="Insert Mermaid Graph Diagram">
                  <span className="btn-icon">📊</span>
                  <span className="btn-text">Mermaid Diagram</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Layout' && (
          <div className="ribbon-groups-container">
            {/* Physical Page configuration layout details */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">Margins Setup</div>
              <div className="ribbon-group-row">
                <button 
                  className={`ribbon-tool-btn layout-btn ${marginType === 'normal' ? 'active' : ''}`}
                  onClick={() => setMarginType('normal')}
                >
                  Normal (25mm)
                </button>
                <button 
                  className={`ribbon-tool-btn layout-btn ${marginType === 'narrow' ? 'active' : ''}`}
                  onClick={() => setMarginType('narrow')}
                >
                  Narrow (12.7mm)
                </button>
                <button 
                  className={`ribbon-tool-btn layout-btn ${marginType === 'wide' ? 'active' : ''}`}
                  onClick={() => setMarginType('wide')}
                >
                  Wide (38.1mm)
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'View' && (
          <div className="ribbon-groups-container">
            {/* Workspace split view toggling */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">Workspace View</div>
              <div className="ribbon-group-row">
                <button 
                  className={`ribbon-tool-btn layout-btn ${viewMode === 'word' ? 'active' : ''}`}
                  onClick={() => setViewMode('word')}
                >
                  📄 Word Mode
                </button>
                <button 
                  className={`ribbon-tool-btn layout-btn ${viewMode === 'split' ? 'active' : ''}`}
                  onClick={() => setViewMode('split')}
                >
                  🥞 Split View
                </button>
                <button 
                  className={`ribbon-tool-btn layout-btn ${viewMode === 'markdown' ? 'active' : ''}`}
                  onClick={() => setViewMode('markdown')}
                >
                  💻 Markdown Mode
                </button>
              </div>
            </div>

            {/* Premium Theme configuration options */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">Appearance</div>
              <div className="ribbon-group-row">
                <button 
                  className={`ribbon-tool-btn layout-btn toggle-dark-btn ${isDarkMode ? 'active' : ''}`}
                  onClick={() => setIsDarkMode(!isDarkMode)}
                >
                  {isDarkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
