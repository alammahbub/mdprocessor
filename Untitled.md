# Welcome to SuperMD!

SuperMD is an enterprise-grade hybrid Markdown word processor that merges visual WYSIWYG editing with clean structural Markdown files.

## Text Formatting

**Bold**, *Italic*, ***Bold Italic***, ~~Strikethrough~~, ++Underline++, <mark>Highlight</mark>, Inserted, and `Inline Code`.

## Links &amp; References

Check out the [Markdown Reference](https://www.markdownlang.com) for more syntax tips.

Automatic links are also supported: [https://www.markdownlang.com](https://www.markdownlang.com) and [email@example.com](mailto:email@example.com)

## Math Formulas

SuperMD supports LaTeX math with KaTeX rendering. Both inline formulas like <span data-math-inline="E = mc^2"></span> and block formulas are fully supported.

Block formulas:

<div data-math-block="\sum_{i=1}^{n} i = \frac{n(n+1)}{2}"></div>

## Interactive Diagrams

Try editing the graph below by clicking on it:

<div data-type="mermaid" data-code="graph TD
  A[Start] --> B(Scaffold Electron + React)
  B --> C{Bidirectional Sync}
  C -->|Yes| D[Wow User with High Fidelity]
  C -->|No| E[Cursor Jump Errors]" data-width="600"></div>

## Tables Support

## Task Lists

- [x] Implemented autolink support
- [x] Enabled typography extension
- [ ] Add more KaTeX formulas
- [ ] Write unit tests

## Extended Syntax

### Fenced Code Blocks

```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}
greet("SuperMD");
```

### Indented Code Block (4 spaces)

```
This is an indented code block.
It uses 4 spaces for indentation.
```

### Definition List

Using raw HTML for extended syntax support:

Markdown

A lightweight markup language for formatting text.

SuperMD

An enterprise-grade hybrid word processor.

### Footnotes

Here's a sentence with a footnote reference.[1](#fn-1)

1. This is the footnote content. [↩](#fnref-1)

### HTML Tags

**Bold via HTML**, *Italic via HTML*, ~~Deleted via HTML~~, Inserted via HTML

---

Enjoy using SuperMD!
