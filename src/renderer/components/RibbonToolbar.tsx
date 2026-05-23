import React from 'react'
import '../styles/ribbon.css'

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
                <button className="ribbon-tool-btn text-btn" onClick={onCut} onMouseDown={(e) => e.preventDefault()} title="Cut Selection (Ctrl+X)">Cut</button>
                <button className="ribbon-tool-btn text-btn" onClick={onCopy} onMouseDown={(e) => e.preventDefault()} title="Copy Selection (Ctrl+C)">Copy</button>
                <button className="ribbon-tool-btn text-btn" onClick={onPaste} onMouseDown={(e) => e.preventDefault()} title="Paste Clipboard (Ctrl+V)">Paste</button>
              </div>
            </div>

            {/* Undo/Redo group */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">Undo & Redo</div>
              <div className="ribbon-group-row">
                <button className="ribbon-tool-btn" onClick={onUndo} onMouseDown={(e) => e.preventDefault()} title="Undo Last Change (Ctrl+Z)" style={{ fontSize: '16px' }}>↶</button>
                <button className="ribbon-tool-btn" onClick={onRedo} onMouseDown={(e) => e.preventDefault()} title="Redo Last Change (Ctrl+Y)" style={{ fontSize: '16px' }}>↷</button>
              </div>
            </div>

            {/* Font & Formatting controls */}
            <div className="ribbon-group" style={{ height: 'auto', minWidth: '220px' }}>
              <div className="ribbon-group-title">Font</div>
              
              {/* Dropdowns row */}
              <div className="ribbon-group-row" style={{ marginBottom: '4px' }}>
                <select 
                  className="ribbon-dropdown font-family-select"
                  value={activeFontFamily}
                  onChange={(e) => onFontFamily(e.target.value)}
                  title="Font Family"
                >
                  <option value="Arial">Arial</option>
                  <option value="Segoe UI">Segoe UI</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Trebuchet MS">Trebuchet MS</option>
                  <option value="Arial Black">Arial Black</option>
                </select>

                <select 
                  className="ribbon-dropdown font-size-select"
                  value={activeFontSize}
                  onChange={(e) => onFontSize(e.target.value)}
                  title="Font Size (pt)"
                >
                  <option value="8">8</option>
                  <option value="9">9</option>
                  <option value="10">10</option>
                  <option value="11">11</option>
                  <option value="12">12</option>
                  <option value="14">14</option>
                  <option value="16">16</option>
                  <option value="18">18</option>
                  <option value="20">20</option>
                  <option value="24">24</option>
                  <option value="28">28</option>
                  <option value="36">36</option>
                  <option value="48">48</option>
                  <option value="72">72</option>
                </select>
              </div>

              {/* Formatting and color buttons row */}
              <div className="ribbon-group-row">
                <button className={`ribbon-tool-btn font-bold ${isBold ? 'active' : ''}`} onClick={onBold} onMouseDown={(e) => e.preventDefault()} title="Bold (Ctrl+B)">B</button>
                <button className={`ribbon-tool-btn font-italic ${isItalic ? 'active' : ''}`} onClick={onItalic} onMouseDown={(e) => e.preventDefault()} title="Italic (Ctrl+I)">I</button>
                <button className={`ribbon-tool-btn font-underline ${isUnderline ? 'active' : ''}`} onClick={onUnderline} onMouseDown={(e) => e.preventDefault()} title="Underline (Ctrl+U)">U</button>
                <button className={`ribbon-tool-btn font-strike ${isStrike ? 'active' : ''}`} onClick={onStrike} onMouseDown={(e) => e.preventDefault()} title="Strikethrough">S</button>
                
                <span className="ribbon-tool-divider"></span>

                {/* Font Color select picker */}
                <div className="color-tool-wrapper">
                  <select
                    className="font-color-picker"
                    value={activeColor}
                    onChange={(e) => onTextColor(e.target.value)}
                    title="Text Color"
                    style={{ borderBottom: `3px solid ${activeColor}` }}
                  >
                    <option value="#323130" style={{ color: '#323130' }}>A - Black</option>
                    <option value="#2b579a" style={{ color: '#2b579a' }}>A - Blue</option>
                    <option value="#0078d4" style={{ color: '#0078d4' }}>A - Cyan</option>
                    <option value="#a80000" style={{ color: '#a80000' }}>A - Red</option>
                    <option value="#107c41" style={{ color: '#107c41' }}>A - Green</option>
                    <option value="#d83b01" style={{ color: '#d83b01' }}>A - Orange</option>
                    <option value="#e3008c" style={{ color: '#e3008c' }}>A - Pink</option>
                    <option value="#7a24db" style={{ color: '#7a24db' }}>A - Purple</option>
                    <option value="#5c6370" style={{ color: '#5c6370' }}>A - Gray</option>
                  </select>
                </div>

                {/* Highlight Color picker */}
                <div className="color-tool-wrapper">
                  <select
                    className="highlight-color-picker"
                    value={activeHighlightColor}
                    onChange={(e) => onHighlightColor(e.target.value)}
                    title="Highlight Color"
                    style={{ backgroundColor: activeHighlightColor === 'transparent' ? 'transparent' : activeHighlightColor }}
                  >
                    <option value="transparent">None</option>
                    <option value="#ffff00" style={{ backgroundColor: '#ffff00' }}>Yellow</option>
                    <option value="#00ff00" style={{ backgroundColor: '#00ff00' }}>Green</option>
                    <option value="#00ffff" style={{ backgroundColor: '#00ffff' }}>Cyan</option>
                    <option value="#ff00ff" style={{ backgroundColor: '#ff00ff' }}>Pink</option>
                    <option value="#ff0000" style={{ backgroundColor: '#ff0000', color: '#ffffff' }}>Red</option>
                    <option value="#b5f5ec" style={{ backgroundColor: '#b5f5ec' }}>Soft Mint</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Paragraph Alignment controls */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">Paragraph</div>
              <div className="ribbon-group-row" style={{ height: '100%', alignItems: 'center' }}>
                <button className={`ribbon-tool-btn ${isLeftAlign ? 'active' : ''}`} onClick={() => onAlignText('left')} onMouseDown={(e) => e.preventDefault()} title="Align Left">
                  ⫷
                </button>
                <button className={`ribbon-tool-btn ${isCenterAlign ? 'active' : ''}`} onClick={() => onAlignText('center')} onMouseDown={(e) => e.preventDefault()} title="Align Center">
                  ☷
                </button>
                <button className={`ribbon-tool-btn ${isRightAlign ? 'active' : ''}`} onClick={() => onAlignText('right')} onMouseDown={(e) => e.preventDefault()} title="Align Right">
                  ⫸
                </button>
                <button className={`ribbon-tool-btn ${isJustifyAlign ? 'active' : ''}`} onClick={() => onAlignText('justify')} onMouseDown={(e) => e.preventDefault()} title="Justify">
                  ☰
                </button>
              </div>
            </div>

            {/* Quick Paragraph Style Controls */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">Styles</div>
              <div className="ribbon-group-row" style={{ height: '100%', alignItems: 'center' }}>
                <button className="ribbon-tool-btn text-btn" onClick={onParagraph} onMouseDown={(e) => e.preventDefault()}>Normal Text</button>
                <button className="ribbon-tool-btn text-btn" onClick={() => onHeading(1)} onMouseDown={(e) => e.preventDefault()}>H1</button>
                <button className="ribbon-tool-btn text-btn" onClick={() => onHeading(2)} onMouseDown={(e) => e.preventDefault()}>H2</button>
                <button className="ribbon-tool-btn text-btn" onClick={() => onHeading(3)} onMouseDown={(e) => e.preventDefault()}>H3</button>
              </div>
            </div>

            {/* Structure markup styles */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">Structure</div>
              <div className="ribbon-group-row" style={{ height: '100%', alignItems: 'center' }}>
                <button className="ribbon-tool-btn text-btn" onClick={onBlockquote} onMouseDown={(e) => e.preventDefault()}>Blockquote</button>
                <button className="ribbon-tool-btn text-btn" onClick={onHorizontalRule} onMouseDown={(e) => e.preventDefault()}>Divider Line</button>
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
                <button className="ribbon-tool-btn insert-block-btn" onClick={onInsertTable} onMouseDown={(e) => e.preventDefault()} title="Insert Table Grid">
                  <span className="btn-icon">📅</span>
                  <span className="btn-text">Insert Table</span>
                </button>
              </div>
            </div>

            {/* Visual illustrations & diagrams */}
            <div className="ribbon-group">
              <div className="ribbon-group-title">Illustrations & Charts</div>
              <div className="ribbon-group-row">
                <button className="ribbon-tool-btn insert-block-btn" onClick={onInsertMermaid} onMouseDown={(e) => e.preventDefault()} title="Insert Mermaid Graph Diagram">
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
