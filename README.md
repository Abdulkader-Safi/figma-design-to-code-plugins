<p align="center">
  <img src="assets/logo.png" alt="Design to HTML logo" width="128" height="128" />
</p>

<h1 align="center">Design to HTML</h1>

<p align="center">A Figma plugin that exports a selected frame to a single self-contained HTML file, keeping the layout, colors, typography, and Google fonts.</p>

## What it does

- Auto-layout frames become flexbox (direction, gap, padding, alignment, hug/fill sizing).
- Static frames and groups become absolutely positioned children.
- Pulls solid and linear-gradient fills, corner radius, borders, and drop/inner shadows.
- Text nodes keep their content, font family, weight, size, color, alignment, line height, letter spacing, and case.
- Vectors and icons are inlined as SVG. Image fills export as PNG data URIs.
- Fonts used by text are emitted as a Google Fonts `<link>`. Non-Google families fall back gracefully.
- Export as plain CSS, or as Tailwind utility classes. Tailwind output is one self-contained file that loads the Tailwind v4 browser CDN, with the styles mapped to utilities (arbitrary values keep the exact pixels and colors).

## Using it

1. Select a frame, component, instance, or group.
2. Pick **CSS** or **Tailwind** styling.
3. Run the plugin and click **Export selected frame**.
4. Copy the code or download the `.html` file.

## Development

```
npm install        # first time
npm run build       # bundle src/ -> code.js (esbuild)
npm run watch       # rebuild on save
npm run typecheck   # tsc, no emit
npm run lint        # eslint
```

Load the plugin in Figma via **Plugins > Development > Import plugin from manifest** and pick `manifest.json`.

Figma loads exactly one main script (`code.js`) and one UI file (`ui.html`). The plugin logic lives in `src/`, split by concern, and esbuild bundles it into the single `code.js` the manifest references. `ui.html` is the panel iframe. The two talk over `postMessage`.

```
src/
  main.ts        entry: shows the UI, handles export requests
  generate.ts    walks the node tree, emits the HTML/CSS document
  semantic.ts    heading / landmark / button tag heuristics
  layout.ts      auto-layout -> flexbox, static frames -> absolute
  decoration.ts  background, radius, borders, shadows
  text.ts        font, size, colour, inline text styling
  tailwind.ts    CSS rule -> Tailwind v4 utility classes
  values.ts      colour + number converters, string helpers
  nodes.ts       node-shape predicates (vector, icon, image, auto-layout)
  document.ts    Google Fonts link + HTML shell
  types.ts       the shared Rule type
```

## Publishing

Figma's `manifest.json` has no icon field, so the plugin icon is set in the Publish modal, not in code. When publishing, upload `assets/logo.png` (128x128) as the plugin icon.

## Support

If this saves you time, you can buy me a coffee. It keeps the plugin maintained.

[![Support on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/abdulkadersafi)

## Author

Created by Abdulkader Safi. [abdulkadersafi.com](https://abdulkadersafi.com)
