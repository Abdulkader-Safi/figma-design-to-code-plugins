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

## Using it

1. Select a frame, component, instance, or group.
2. Run the plugin and click **Export selected frame**.
3. Copy the code or download the `.html` file.

## Development

```
npm install        # first time
npm run build       # compile code.ts -> code.js
npm run watch       # rebuild on save
npm run lint        # eslint
```

Load the plugin in Figma via **Plugins > Development > Import plugin from manifest** and pick `manifest.json`.

`code.ts` runs in the Figma sandbox (has the `figma` API). `ui.html` is the panel iframe. They talk over `postMessage`.

## Publishing

Figma's `manifest.json` has no icon field, so the plugin icon is set in the Publish modal, not in code. When publishing, upload `assets/logo.png` (128x128) as the plugin icon.

## Support

If this saves you time, you can buy me a coffee. It keeps the plugin maintained.

[![Support on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/abdulkadersafi)

## Author

Created by Abdulkader Safi. [abdulkadersafi.com](https://abdulkadersafi.com)
