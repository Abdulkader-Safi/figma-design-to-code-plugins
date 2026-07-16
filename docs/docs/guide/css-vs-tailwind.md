---
title: CSS or Tailwind
description: Both export the same design with the same pixels. Here is when to pick plain CSS and when to pick Tailwind.
---

# CSS or Tailwind

At the top of the panel you choose how styles are written: plain **CSS** or **Tailwind** utility classes. Both describe the same design with the same measurements. The difference is where the export is going to live.

## Plain CSS

CSS mode gives you a stylesheet inside the file. Each element gets a class, and the styles sit in a `<style>` block at the top.

Reach for CSS when:

- **You want a file that just works.** Open it in any browser, offline, with nothing to install or build. Everything the page needs, styles, fonts link, images, is inside the one file.
- **You are sending it to someone** as a standalone artifact, or dropping it somewhere that has no build step.
- **You want to read the styles** as ordinary CSS and edit them by hand.

The output uses a small reset, then one rule per element. Semantic tags like `<button>` and `<a>` are stripped of their default browser chrome, so they look exactly like the layer, not like a default form control.

## Tailwind

Tailwind mode puts utility classes on each element (`flex`, `justify-center`, `text-[48px]`, `bg-[#0c0b0a]`). The file loads the Tailwind v4 browser build, which compiles those classes when the page opens.

Reach for Tailwind when:

- **You are building in a Tailwind project.** Copy the classes straight onto your components and keep working in the system you already use.
- **You want to iterate with utilities** rather than editing a stylesheet.
- **You want idiomatic Tailwind.** Spacing, sizing, borders, radius, weight, and opacity map to Tailwind's own utilities. Exact pixels and colors that have no named utility stay as arbitrary values like `text-[18px]` or `bg-[#16140f]`, so the design stays pixel-accurate.

Fonts come through as a small `@theme` block, so your text uses real font utilities such as `font-inter`, not a raw family string.

## The one tradeoff to know

Tailwind mode renders by compiling in the browser, so **viewing the Tailwind file needs an internet connection** the first time it loads the Tailwind build. Plain CSS has no such dependency and works fully offline.

If you need an artifact that opens anywhere with no network, use CSS. If you are pasting into a codebase that already runs Tailwind, use Tailwind.

## Which should I pick?

| Your situation                                   | Pick     |
| ------------------------------------------------ | -------- |
| A standalone file to open or share, offline      | CSS      |
| Handing a static page to someone with no build   | CSS      |
| Pasting into a Tailwind React or Vue component   | Tailwind |
| Working in a project that already uses Tailwind  | Tailwind |
| Not sure yet                                     | CSS      |

You are not locked in. Run the export again with the other option and you get the same design written the other way.

Next: [export the file](/guide/exporting) and put it to use.
