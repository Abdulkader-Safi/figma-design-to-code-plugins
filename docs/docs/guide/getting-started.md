---
title: Getting started
description: Install Design to HTML, run your first export, and get the HTML out in under a minute.
---

# Getting started

This walks through your first export, start to finish.

## Install the plugin

If you have the published plugin, add it from the Figma community and skip to the next step.

To run it from source:

1. Clone the repository and run `npm install`, then `npm run build`. This produces `code.js` and `ui.html`, the two files Figma loads.
2. In Figma, open **Plugins → Development → Import plugin from manifest**.
3. Pick the `manifest.json` in the project root.

The plugin now shows up under **Plugins → Development → Design to HTML**.

## Run your first export

1. **Select one layer.** A frame, component, instance, or group. Select the outermost thing you want as the page. The plugin exports that node and everything inside it.
2. **Open the plugin.** A panel opens with two choices at the top.
3. **Pick your styling:** CSS or Tailwind. If you are not sure, start with CSS.
4. **Leave semantic tags on** unless you have a reason to turn them off. They give you real HTML tags instead of a pile of `div`s.
5. **Click Export selected frame.** The preview fills with the generated HTML.
6. **Copy the code**, or **download** the `.html` file.

Open the downloaded file in a browser. It should look like your frame, because everything it needs, the styles, the fonts link, the images, is inside that one file.

## If the export looks off

A few quick checks, in order:

- **Nothing selected?** The plugin needs exactly one selected layer. Select the frame and run it again.
- **Everything is absolutely positioned?** Your frame is not using auto layout. See [Use auto layout](/guide/auto-layout).
- **Titles are plain paragraphs?** The plugin did not see them as headings. See [Headings and text](/guide/headings-and-text).
- **A tag is wrong or missing?** The layer name drives it. See [Name your layers](/guide/naming-layers).

## What to read next

Once you have a working export, the next three pages are about designing the frame so the export comes out clean the first time. Start with [naming your layers](/guide/naming-layers).
