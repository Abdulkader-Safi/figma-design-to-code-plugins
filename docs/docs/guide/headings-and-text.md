---
title: Headings and text
description: How Design to HTML decides what is a heading, a paragraph, a link, or a list item, and how to design so titles export as h1 to h4.
---

# Headings and text

The plugin does not read layer names to find your titles. It reads font size. The most common text size on the page is treated as body copy, and text that is clearly larger becomes a heading. This means a consistent type scale gives you clean `<h1>` to `<h4>`, with no tagging by hand.

## How a heading is chosen

Two things have to be true for a text layer to become a heading:

1. **Its size is a heading size.** The plugin finds the most common text size and calls it body. Any size at least 20% larger than body is a heading. The largest such size becomes `<h1>`, the next `<h2>`, and so on, down to `<h4>`. It ranks up to four heading sizes.
2. **The text is short and single line.** A heading has to be 40 characters or fewer, on one line. Longer text, or text with a line break, stays a paragraph even at a large size. This keeps a big intro sentence from being marked as an `<h1>`.

Everything else is a `<p>`.

## Design so headings land right

The system rewards a normal, consistent type scale. A few habits make it reliable:

- **Keep body copy the most common size.** Body should be the size you use most on the page. If your page is mostly large text, the plugin has nothing to measure against and headings get confused.
- **Use one size per level.** Give every H1 the same size, every H2 the same smaller size, and so on. The plugin groups by exact size, so a title at 47px and another at 48px are read as two different levels.
- **Make headings clearly bigger.** A title only 10% larger than body will not be promoted. Keep at least a 20% jump. A real type scale (for example 16 body, 20, 24, 32, 48) does this naturally.
- **Keep titles short.** Under 40 characters and on one line. If a heading has to be longer, it will export as a paragraph. Either shorten it or accept the `<p>`.
- **Four levels is the ceiling.** Only the four largest heading sizes get `<h1>` through `<h4>`. If you have five distinct large sizes, the fifth stays a paragraph. Collapse your scale so you use four heading sizes or fewer.

## Links

Links need no naming and no size. If a text layer has a Figma hyperlink, it exports as an `<a>` pointing at that URL. Add hyperlinks to your text in Figma and they come through as real links.

## List items

Text and frames become `<li>` automatically when they are the direct children of a list. Name the container `list` or `menu` (see [Name your layers](/guide/naming-layers)), and each direct child becomes a list item. You do not tag the items themselves.

## Mixed styles in one text layer

If a single text layer has more than one style inside it, for example one word bold or in a different color, the plugin keeps it. That run is exported as a `<span>` with its own style, inside the paragraph or heading. You do not need to split the layer.

## A quick example

With a type scale of 16px body, 24px, and 48px:

```text
"Ship faster"            48px, 11 chars, one line   →  <h1>
"Why teams switch"       24px, 16 chars, one line   →  <h2>
"One click turns your
 frame into markup."     16px, two lines            →  <p>  (body size)
"Read the docs"          16px, with a hyperlink     →  <a>
```

Next: choose your output format, [CSS or Tailwind](/guide/css-vs-tailwind).
