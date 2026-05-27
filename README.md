# 📄 SuperMD: A High-Fidelity Hybrid Markdown Word Processor

SuperMD is a premium, enterprise-grade desktop word processor built with Electron, React, and TypeScript. It bridges the gap between structured Markdown speed and the advanced, paginated visual fidelity of professional word processors like Microsoft Word.

SuperMD establishes **Markdown (`.md`) as the single source of truth** while offering two fully synchronized, real-time interfaces:
1.  **Word Mode (WYSIWYG Layout):** A rich, paginated, physical page emulator (A4) featuring a responsive MS Word-style **Ribbon Interface**, custom margins, and direct drag-and-resize media elements.
2.  **Markdown Mode (IDE Editor):** A developer-grade code editor built on **CodeMirror 6** with syntax highlighting, line numbers, folding, invisible characters, and structural sync.

---

## ✨ Outstanding Core Features

### 🔄 Bidirectional AST Sync Engine
*   **Zero-Cursor Jump:** Direct ProseMirror AST to CodeMirror 6 transaction mapping ensures seamless edits in either pane without resetting selection ranges or scroll positions.
*   **Synchronized Caret:** Renders a custom blinking caret visible in the blurred editor frame for fluid visual continuity.

### 🎀 MS Word-Style Ribbon & Tab Toolbar
*   **Home Tab:** Controls for Font Family, Size, Bold (`**`), Italic (`*`), Underline (`<u>`), Strikethrough (`~~`), Subscript/Superscript (`<sub>`/`<sup>`), Text Highlight Color (`<mark>`), text alignments (Left/Center/Right), line spacing, and markdown style headers.
*   **Insert Tab:** Interactive visual grid selectors for HTML/GFM tables, image imports (local or drag-and-drop), inline/block LaTeX formulas, bookmarks, and Mermaid.js diagrams.
*   **Layout Tab:** Instantly configures physical page setup (Normal, Narrow, Wide margins).
*   **View Tab:** Fast switches between Word Mode Only, Markdown Mode Only, Split View, and a distraction-free Fullscreen canvas.
*   **Settings (Shortcut Manager):** Allows users to rebind hotkey shortcuts (e.g. Bold, Italic, Save, Redo) inside an interactive keyboard capture modal.

### 📊 Offline Mermaid & LaTeX Compilers
*   **Mermaid Node Views:** Converts language-tagged ` ```mermaid ` code blocks into vector SVGs asynchronously in the background. Features double-click glassmorphic edit overlays with live syntax check indicators and diagram template builders (Flowcharts, Class diagrams, pie charts, etc.).
*   **KaTeX Math Engine:** Centered block (`$$...$$`) and inline (`$...$`) math formulas rendered on the page, with double-click editors.

### 📥 High-Fidelity Exports & Printing
*   **Professional PDF Export:** Electron main-process handler print options tailored to A4 sheets with `@media print` layout overrides, proper header/footer spacing, and a 1.5s rendering delay for asynchronous content.
*   **MSO-Compliant DOCX Export:** IPC wrapper transforming rich HTML into an Office Open XML compliant format inside an MHTML envelope, supporting standard Calibri spacing and print layout definitions for MS Word.
*   **Web Fallback Printing:** Elegant browser compatibility printing utilizing temporary offscreen print iframes if run outside of Electron.

---

## 🏗️ Technical Architecture

SuperMD leverages a fully decoupled, sandbox-isolated process architecture:

```
                  ┌────────────────────────────────────────┐
                  │          Electron Main Process         │
                  │   - App Lifecycle   - File OS I/O      │
                  │   - OS Native Menus - PDF/DOCX Write   │
                  └───────────────────▲────────────────────┘
                                      │
                         IPC Bridge (Context Bridge)
                                      │
                  ┌───────────────────▼────────────────────┐
                  │         Renderer Window UI (Vite)      │
                  │  - Global State    - Ribbon UI         │
                  │  - Theme Engine    - Settings Manager  │
                  │  ┌──────────────────────────────────┐  │
                  │  │     Dual-Canvas Sync Engine      │  │
                  │  │ ┌──────────────┐ ┌─────────────┐ │  │
                  │  │ │  Word Mode   │ │Markdown Mode│ │  │
                  │  │ │ (ProseMirror)│ │(CodeMirror6)│ │  │
                  │  │ └──────────────┘ └─────────────┘ │  │
                  │  └──────────────────────────────────┘  │
                  └────────────────────────────────────────┘
```

---

## 🛡️ Stability & Resilience Specs

### 1. Stale Editor View Guard
In Tiptap v3, calling `.view.focused` or accessing `.state` during React component unmount/remount (which occurs on file transitions) throws an unhandled runtime error. SuperMD implements robust `try-catch` blocks and `!editorInstance.isDestroyed` safeguards globally to prevent UI shell crashes.

### 2. ProseMirror Atom Node Spec Fixes
ProseMirror constraints dictate that leaf nodes (`atom: true`) must not contain content holes (`0`) in their `renderHTML` schema configurations. SuperMD corrects `MathInlineExtension` and `MermaidExtension` schemas to remove standard content holes, guaranteeing error-free document compilation and native exports.

---

## 🚀 Running and Building

### Prerequisites
*   **Node.js** (v18+)
*   **Yarn** (Preferred)

### Setup & Dev Run
1.  **Install dependencies**:
    ```bash
    yarn install
    ```
2.  **Start the Electron development server**:
    ```bash
    yarn dev
    ```
3.  **Compile & check types**:
    ```bash
    yarn tsc -b
    ```
