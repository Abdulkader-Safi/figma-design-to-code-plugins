---
title: Introduction
description: What Design to HTML does, what it reads from your Figma file, and how to get the cleanest export.
---

# Introduction

Design to HTML is a Figma plugin. You select a frame, and it gives you working HTML that keeps the layout, colors, typography, and fonts. You can copy the code, or download it: a page with images comes out as a zip of `index.html`, `styles.css` and an `images/` folder, and a page without images as a single self-contained file.

The point is to skip the slow part of handoff. Instead of measuring spacing by hand and retyping styles, you export the frame and start from working markup.

## What it reads from your design

The plugin walks the frame you selected, top to bottom, and turns each layer into an element:

- **Auto layout frames** become flexbox: direction, gap, padding, alignment, and hug/fill sizing all carry over.
- **Static frames and groups** become absolutely positioned children, placed at their real coordinates.
- **Fills** come through as solid colors or gradients. Linear gradients keep their real angle. Radial and angular gradients export with all their stops.
- **Text** keeps its content, font family, weight, size, color, alignment, line height, letter spacing, and case.
- **Vectors and icons** inline as SVG, so a multi-part icon renders as one piece.
- **Image fills** export as PNG files under `images/`, written once each however many layers use them. Stacked fills keep their opacity, blend modes and image adjustments.
- **Fonts** used by your text are emitted as a Google Fonts link. Families that are not on Google fall back to a system font.

## What you decide

Two things change the output, and both are one click:

1. **Semantic tags** on or off. With them on, the plugin reads your layer names and text sizes to pick real tags: `nav`, `header`, `section`, `footer`, headings, buttons, links. With them off, everything is a `div` or a `p`.
2. **CSS or Tailwind.** CSS is a plain stylesheet inside the file, good for an offline artifact. Tailwind is utility classes on each element, good for pasting into a component.

## How to get a clean export

The export is only as good as the file it reads. A frame built with loose groups and generic layer names still exports, but you get a wall of `div`s at absolute positions. A frame built with auto layout and clear names exports as readable, semantic HTML you would be happy to commit.

The rest of this guide is how to build that kind of frame:

- [Name your layers](/guide/naming-layers) so the semantic tags land right.
- [Use auto layout](/guide/auto-layout) so the export is flexbox, not absolute boxes.
- [Set up headings and text](/guide/headings-and-text) so titles become real headings.
- [Choose CSS or Tailwind](/guide/css-vs-tailwind) for your use case.
- [Export the file](/guide/exporting) and use it.
