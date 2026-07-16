---
title: Export the file
description: Run the export, get the HTML out, and understand what is inside the file you get back.
---

# Export the file

Once your frame is built with auto layout and clear names, the export itself is quick.

## Steps

1. **Select the frame** you want as the page. Select the outermost node. The plugin exports that node and everything inside it.
2. **Open the plugin** and pick your options: CSS or Tailwind, and semantic tags on or off.
3. **Click Export selected frame.** The preview fills with the generated HTML.
4. **Copy the code** into your project, or **download** the `.html` file.

## What you get

One self-contained HTML file. Everything the page needs is inside it:

- **The markup**, built from your frame, with semantic tags if you left them on.
- **The styles**, as a `<style>` block (CSS mode) or utility classes plus a small config (Tailwind mode).
- **A Google Fonts link** for the font families your text uses. Families that are not on Google fall back to a system font, so nothing breaks.
- **Your images**, embedded as PNG data URIs. There are no separate image files to carry around.
- **Your icons and vectors**, inlined as SVG, so they stay crisp at any size and multi-part icons render as one piece.

Because it is one file with no external assets except the fonts link, you can open it straight in a browser, drop it into a static host, or paste the relevant part into a component.

## Semantic tags on or off

- **On** (recommended): you get real tags. The nav is a `<nav>`, sections are `<section>`, titles are headings, buttons are `<button>`. This is what the naming and heading guides are about.
- **Off**: every container is a `<div>` and every text is a `<p>`. Use this when you only want the visual layout and plan to add your own structure.

## Getting the cleanest result

If the output is not what you expected, it is almost always the design, not the export. Work back through the guide:

- Missing or wrong tags → [Name your layers](/guide/naming-layers).
- Absolute boxes instead of flexbox → [Use auto layout](/guide/auto-layout).
- Titles as paragraphs → [Headings and text](/guide/headings-and-text).

A frame built the way this guide describes exports as HTML you can commit as is.

## Support the plugin

If Design to HTML saves you time, you can [buy me a coffee](https://ko-fi.com/abdulkadersafi). It keeps the plugin maintained.

Built by [Abdulkader Safi](https://abdulkadersafi.com).
