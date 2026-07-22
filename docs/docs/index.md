---
title: Design to HTML
description: A Figma plugin that exports a selected frame to working HTML and CSS, keeping the layout, colors, typography, and fonts. Export as plain CSS or Tailwind.
pageType: home

hero:
  name: Design to HTML
  text: Your Figma frame, as clean HTML
  tagline: Select a frame and get working HTML back. Real layout, real semantics, plain CSS or Tailwind. No handoff back-and-forth.
  image:
    src: /logo.png
    alt: Design to HTML
  actions:
    - theme: brand
      text: Read the guide
      link: /guide/introduction
    - theme: alt
      text: Getting started
      link: /guide/getting-started
features:
  - title: Auto layout becomes flexbox
    details: Direction, gap, padding, alignment, and hug/fill sizing map straight to flexbox. Static frames become absolutely positioned children.
    icon: 📐
    link: /guide/auto-layout
  - title: Semantics from your layer names
    details: Name a frame "nav", "footer", or "hero" and it exports as the matching tag. Short text at a large size becomes a heading. No manual markup.
    icon: 🏷️
    link: /guide/naming-layers
  - title: CSS or Tailwind, your call
    details: Plain CSS gives you an offline file that opens anywhere. Tailwind gives you utility classes ready to paste into a component.
    icon: 🎛️
    link: /guide/css-vs-tailwind
  - title: Fonts and color, kept
    details: Google fonts come through as a link tag. Solid and gradient fills, radius, borders, and shadows carry over with the exact pixels.
    icon: 🎨
    link: /guide/getting-started
  - title: Icons stay crisp
    details: Vectors and icons inline as SVG so multi-part icons render as designed. Image fills come out as PNG files in an images folder, each written once.
    icon: ✒️
    link: /guide/exporting
  - title: One file, ready to ship
    details: Copy the code or download the .html. Everything the page needs is inside it, so it opens in any browser with nothing else to install.
    icon: 📦
    link: /guide/exporting
---
