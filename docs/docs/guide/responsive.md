---
title: Responsive export
description: Design a page at several widths, name the frames with a shared prefix, and export one responsive HTML file that reflows across breakpoints.
---

# Responsive export

Design the same page at more than one width, select all the frames, and the plugin merges them into one responsive file. The page reflows across breakpoints in CSS or Tailwind, with no duplicate markup.

## Name the frames

Give every variant the same name, then a ` - ` and a label:

```
Home Page - Desktop
Home Page - Tablet
Home Page - Mobile
```

The part before the last ` - ` is the shared prefix. Frames that share it are treated as one page. The label after it ("Desktop", "Mobile", or anything else) is just for you. It does not decide anything.

## Select and export

Select two or more frames of the same page and export as usual. The status line confirms what it found, for example `3 frames -> base 390, lg, 2xl`. The download name is the shared prefix, and the output is the same shape as a single-frame export: a zip of `index.html`, `styles.css` and `images/` when the page has images, otherwise one file.

Each layer is styled from the frame it belongs to, so a property one frame pins and a larger one leaves automatic is released at that breakpoint rather than carried up. Backgrounds, including stacked fills with blend modes, come through at every breakpoint.

You do not need all three sizes. Any two or more work:

- Desktop and mobile.
- Laptop and tablet.
- Tablet and mobile.

A dashboard with no mobile view is fine. A mobile app screen with no desktop is fine. Design the sizes the page actually needs.

## Width sets the breakpoint

The label is only a name. The frame's width decides where its layout applies. The smallest frame is the base and applies everywhere. Each larger layout switches on around the midpoint between it and the next-smaller frame, snapped to the nearest standard breakpoint:

| Breakpoint | Min width |
| ---------- | --------- |
| base       | 0         |
| sm         | 640px     |
| md         | 768px     |
| lg         | 1024px    |
| xl         | 1280px    |
| 2xl        | 1536px    |

So a mobile frame at 390px and a desktop frame at 1440px switch at their midpoint, about 915px, which snaps to `lg` (1024px): the desktop layout shows from 1024px up, mobile below it. The switch sits between the two designed sizes, the way you would place a breakpoint by hand, rather than at the larger frame's own width. This is mobile-first: the base styles apply to every screen and wider frames override them upward, the same in CSS and Tailwind.

## What the output looks like

The page is built from the base frame's structure, and larger frames only change what is different.

**CSS** uses min-width media queries, and each query holds only the properties that change at that size:

```css
.title { font-size: 32px; }
@media (min-width: 1280px) {
  .title { font-size: 58px; }
}
```

**Tailwind** uses the standard responsive prefixes, again only on what changes:

```html
<h1 class="text-[32px] xl:text-[58px]">Digital Solutions</h1>
```

Images and icons that appear in more than one frame are exported once, so a responsive file is far smaller than three separate exports.

## Getting a clean merge

The plugin pairs elements across your frames to know they are the same thing. It matches by layer name first, and falls back to position when a layer has no name. So the cleanest result comes from naming the matching elements the same in every frame. If you rename the header in the mobile frame, it is treated as a different element from the desktop header.

A few things to keep in mind:

- **An element that appears in one size only** (a sidebar that is desktop-only, say) is kept and shown only at the sizes where it exists.
- **An element that moves to a different container between sizes** (a menu that sits in the header on desktop and in a drawer on mobile) is duplicated and shown or hidden per breakpoint. Keep these moves to whole components, not large chunks of the page.
- **Text that differs per size** (a short label on mobile, a longer one on desktop) is shown or hidden per breakpoint, so both strings are in the file.

## Support the plugin

If Design to HTML saves you time, you can [buy me a coffee](https://ko-fi.com/abdulkadersafi). It keeps the plugin maintained.

Built by [Abdulkader Safi](https://abdulkadersafi.com).
