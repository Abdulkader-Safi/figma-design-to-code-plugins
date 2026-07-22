---
title: Use auto layout
description: Auto layout frames export as flexbox. Learn how direction, spacing, padding, alignment, and sizing map to CSS.
---

# Use auto layout

This is the single biggest lever on export quality. An auto layout frame becomes a flexbox container, with real gaps and padding. A plain frame or group becomes a box with its children absolutely positioned at fixed coordinates.

Absolute positioning is not wrong, and the plugin falls back to it so a non-auto-layout design still exports. But flexbox is what you want in real markup: it reflows, it is readable, and it is what a developer would have written. So use auto layout wherever the design is a row or a column of things.

## Turn it on

Select a frame and press **Shift + A**, or add auto layout from the right panel. Do this for every frame that is really a stack or a row: the nav, the button, a card, a list, the whole page column.

Once a frame has auto layout, here is how each setting lands in the export.

## Direction and gap

- **Direction** (horizontal or vertical) becomes `flex-direction: row` or `column`.
- **The gap between items** (the spacing value in auto layout) becomes `gap`. Set it once on the frame instead of nudging each child.

### Negative gap

Figma lets the gap go negative so items overlap. CSS `gap` cannot, so the export uses a negative margin between siblings instead, which produces the same overlap and the same hugging size.

Overlap also makes stacking order visible, so **Canvas stacking** carries over: "Last on top" is the default, and "First on top" exports as a descending `z-index`.

### Wrap

Turn on **Wrap** and the row exports with `flex-wrap: wrap`. The two spacing values map separately: the gap becomes `column-gap`, and the gap between wrapped lines becomes `row-gap`. The alignment across lines is carried over too, so lines are not stretched.

Wrapping needs a resolved width, so set the frame to **Fixed** or **Fill** on its main axis, not Hug.

## Grid

Figma's **Grid** auto layout exports as CSS grid, not flexbox:

- Column and row tracks map directly. A **Flex** track becomes `1fr`, a **Fixed** track becomes pixels, and a **Hug** track becomes `fit-content`.
- The two gaps become `column-gap` and `row-gap`.
- Each child keeps the cell it sits in and any span, as `grid-column` and `grid-row`.

Layout guides (the red column overlays under **Layout guide**) are not the same thing. They are visual guides only, so they are deliberately not exported: they position nothing in Figma, and turning them into a CSS grid would invent structure the design does not have.

## Padding

The four padding values on the auto layout frame become CSS padding, per side. Top, right, bottom, and left each carry over exactly. Set padding on the frame rather than adding spacer layers, and it exports as real padding.

## Alignment

The alignment control in auto layout (the nine-dot grid) sets both axes:

- How items sit along the direction becomes `justify-content` (start, center, end, or space-between).
- How items sit across the direction becomes `align-items`.

So a nav with items pushed to the ends exports with `justify-content: space-between`, and a centered row exports with `align-items: center`. No manual CSS.

## Sizing: fill, hug, and fixed

This is the part worth getting right, because it controls how each child behaves in the exported flexbox. In auto layout, every child has a horizontal and a vertical sizing mode:

- **Fill container** becomes a growing flex item (`flex: 1 1 0`), or stretches across the other axis. Use it for the element that should take the leftover space, like a search box that fills the bar.
- **Hug contents** lets the element size to its content, the normal default.
- **Fixed** exports as an exact pixel width or height. A child set to a fixed size keeps that size and will not be squished by its parent, which matches what you see in Figma.

Match the sizing mode to intent. If a button should stay its own width, keep it hug or fixed. If a field should stretch, set it to fill. The export respects whichever you chose.

## When absolute positioning is the right call

Not everything is a stack. A badge pinned to the corner of a card, a decorative shape behind a heading, an overlapping composition: these are genuinely positioned, not laid out in a flow. For those, a plain frame with the child placed where you want it is correct, and the plugin exports it as absolute positioning at those coordinates.

The rule of thumb: if you would describe it as "a row of" or "a column of", use auto layout. If you would describe it as "this thing sits on top of that thing", a plain frame is fine.

## Quick checklist

- Auto layout on every row and column, including the outer page frame.
- Gap set on the frame, not faked with spacer layers.
- Padding set on the frame, not faked with empty margins.
- Sizing mode (fill / hug / fixed) chosen on purpose for each child.
- Plain frames kept only for things that truly overlap or are pinned.

Next: [headings and text](/guide/headings-and-text), so your titles export as real headings.
