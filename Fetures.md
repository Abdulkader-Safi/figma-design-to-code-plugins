# Feature ideas

Ideas for making Design to HTML more useful, based on what the leading Figma to code plugins offer (Anima, Locofy, Builder.io Visual Copilot, TeleportHQ, pxCode, and the open-source bernaferrari/FigmaToCode) and where they fall short.

## Where the plugin stands today

Already shipped, so these are the baseline:

- Auto-layout to flexbox, static frames and groups to absolute positioning.
- Solid fills, gradients (linear at the true angle, plus radial and angular), per-side borders, corner radius, drop and inner shadows.
- Full text styling: family, weight, size, color, alignment, line height, letter spacing, case.
- Vectors and icons inlined as SVG, image fills exported as PNG. (Note: FigmaToCode does not support these at all, so this is a real edge.)
- Google Fonts link built from the fonts actually used.
- Three export modes: HTML and CSS together, HTML alone, CSS alone.
- Offline syntax highlighting, copy, and download.

## Tier 0: quick wins, high value

- [ ] **Settings panel with unit choice (px or rem).** Add a base font size and convert px to rem. Most teams want rem. Store settings with `figma.clientStorage` so they persist.
- [ ] **Deduplicate identical CSS rules.** Many nodes share the same styles. Collapse them into shared classes instead of one class per node. Smaller, cleaner output.
- [x] **Semantic tags from node type and layer name.** Use `button`, `nav`, `header`, `section`, `ul`, `h1` to `h6`, `p`, and `img` where the intent is clear, instead of `div` everywhere. Big readability jump for a small change.
- [ ] **Formatted vs minified toggle.** Some people want to paste, some want to ship.
- [ ] **Quote style and class prefix options.** Small, but reviewers and teams care about house style.
- [x] **Fix gradient angle.** Read `gradientTransform` for the real angle instead of the fixed 180deg fallback, and support radial and angular gradients with all stops.

## Tier 1: the features competitors win on

- [x] **Tailwind CSS output mode.** This is the single most requested format across every tool. Map spacing, colors, flex, and typography to Tailwind utility classes. Offer arbitrary values for anything off-scale.
- [ ] **Design tokens as CSS variables.** Read Figma Variables and shared Styles, emit a `:root` block of custom properties, and reference the tokens instead of repeating raw hex and pixel values. Locofy and Builder.io both lean on this.
- [ ] **Responsive output.** Read Figma constraints (pin, stretch, center, scale) and auto-layout to produce responsive CSS: percentages, `min`/`max-width`, `clamp()`, and media queries, rather than fixed pixel widths. This is the biggest gap versus the paid tools.
- [ ] **Flex-wrap support.** Figma now has wrapping auto-layout. Map it to `flex-wrap: wrap`.
- [ ] **Component and instance awareness.** Detect repeated instances and emit one reusable class or component instead of duplicating markup. Cleaner output and much smaller files.

## Tier 2: framework outputs

- [ ] **React / JSX output.** `className`, self-closing tags, and a choice between inline style objects, CSS Modules, or Tailwind classes.
- [ ] **Vue and Svelte single-file components.** Reuse the same style engine, change the wrapper.
- [ ] **Copy as JSX quick action.** A one-click "copy this node as a React component."

Each new framework is mostly a new renderer over the same node walk, so the intermediate model is worth building once.

## Tier 3: workflow and polish

- [ ] **Live preview inside the plugin.** Render the generated HTML in a sandboxed iframe next to the code, so people see the result without leaving Figma.
- [ ] **Export any selected node, not just frames.** Let people grab a single button or card.
- [ ] **Download as a zip.** Bundle `index.html`, `styles.css`, and an `assets/` folder with real image files instead of inline base64, which keeps the HTML small.
- [ ] **Image handling options.** Background-image for image fills on containers, and a choice between inline base64 and exported asset files.
- [ ] **Accessibility passes.** Alt text from layer names, real heading levels, and basic aria where the node type implies it.
- [x] **Mixed text styles.** Support multiple styles inside one text node by emitting `span`s, plus text truncation and decoration color.
- [ ] **Theme modes.** If Figma Variables have light and dark modes, emit both as CSS variable sets.
- [ ] **Send to CodePen or CodeSandbox.** A share button for quick handoff.

## Notes on positioning

The paid tools compete on AI conversion and many frameworks. This plugin can win by being free, fast, offline, honest about what it exports, and genuinely clean. The highest-leverage additions are Tailwind output, design tokens, and responsive handling, in that order. They close the gap with the paid tools while keeping the plugin simple.

## Sources

- https://github.com/bernaferrari/FigmaToCode
- https://www.sixtythirtyten.co/blog/from-figma-to-code-ai-design-to-dev-workflows-in-2026
- https://www.aidesigner.ai/blog/figma-to-code-tools
- https://uistudioz.com/blog/best-figma-to-html-conversion-tools/
- https://sitegrade.io/en/blog/locofy-vs-builder-io-vs-anima-design-to-code-2026/
