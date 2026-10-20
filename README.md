# DoLess — SVG to Visio (`.vsdx`) Converter

A privacy-first, client-side web application that transforms SVG diagrams and illustrations into native, editable Microsoft Visio (`.vsdx`) packages while preserving structure and design.

## Features

- **Nested Group Preservation**: Converts SVG `<g>` hierarchy into recursive Visio `<Shape Type="Group">` containers with localized bottom-left inch coordinates.
- **Smart Multi-Line Text Merging**: Automatically merges `<tspan>` line breaks and vertically stacked `<text>` nodes inside flowchart boxes into single unified Visio text shapes with per-line character runs (`<cp IX="..."/>`).
- **Complete Vector Path Normalization**: Converts all SVG path commands (`M, L, H, V, C, S, Q, T, A, Z`) and geometric primitives (`<rect>`, `<circle>`, `<ellipse>`, `<polygon>`, `<polyline>`) into Visio `RelMoveTo`, `RelLineTo`, and `RelCubBezTo` ShapeSheet rows.
- **1D Connector & Arrowhead Detection**: Maps 2-point lines and `marker-end` arrows into Visio 1D connectors (`ObjType="2"`, `BeginX/Y`, `EndX/Y`, `EndArrow="4"`).
- **100% Client-Side & Private**: All parsing, sanitization, and Open Packaging Conventions (OPC) ZIP compression happen in-memory inside the browser.

## Project Structure

```text
DoLess/
├── index.html               # Application entry point
├── package.json             # Project manifest & scripts
├── server.js                # Hardened local static HTTP server
├── src/
│   ├── app.js               # UI controller, SVG XSS sanitizer & state manager
│   ├── styles.css           # Editorial UI stylesheet
│   ├── svg-to-vsdx.js       # SVG DOM walker, text merger & .vsdx XML builder
│   ├── svg-path-parser.js   # Path normalizer, Bezier/Arc math & affine matrices
│   ├── samples.js           # Built-in sample SVG diagrams
│   └── vendor/
│       └── jszip.min.js     # Local JSZip bundle
└── tests/
    └── verify.js            # Automated verification suite
```

## Quick Start

```bash
# Start local server at http://localhost:3000
node server.js

# Run verification tests
node tests/verify.js
```
