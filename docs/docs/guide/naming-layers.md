---
title: Name your layers
description: Layer names drive the semantic tags. Learn the exact keywords Design to HTML looks for and where each one works.
---

# Name your layers

When semantic tags are on, the plugin reads your layer names to pick real HTML tags. A frame named `nav` exports as `<nav>`. A frame named `footer` exports as `<footer>`. Get the names right and you get semantic markup for free.

The matching is deliberately careful. A layer only leaves the plain `<div>` when a name clearly signals a tag, so a bad guess never overrides the safe default and the HTML stays valid.

## How matching works

Three rules that are worth knowing before the keyword list:

1. **Names are matched as whole words, lowercased.** `Nav Bar` matches `nav`. `navigation` matches. But `topnav` does not, because `nav` is not a separate word there. Keep the keyword as its own word.
2. **Case and extra words do not matter.** `Main Footer`, `footer`, and `Site Footer 2` all match `footer`.
3. **Some tags only work at the top level.** `header`, `section`, `hero`, and `main` are common words inside group names, so they only count for the direct children of the frame you selected, not for nested groups. The others work at any depth.

## Keywords that work anywhere

Name a layer with any of these and it becomes that tag, at any nesting depth:

| Put this in the name | You get   | Use it for                          |
| -------------------- | --------- | ----------------------------------- |
| `nav`, `navbar`, `navigation` | `<nav>`   | The top navigation bar              |
| `footer`             | `<footer>`| The page footer                     |
| `aside`, `sidebar`   | `<aside>` | A side column or supporting panel   |
| `article`, `blog post` | `<article>` | A self-contained post or card    |
| `list`, `menu`       | `<ul>`    | A list. Its direct children become `<li>` |

## Keywords that work at the top level only

These only apply to the direct children of the frame you selected:

| Put this in the name | You get     | Use it for                     |
| -------------------- | ----------- | ------------------------------ |
| `header`             | `<header>`  | The top band of the page       |
| `section`, `hero`    | `<section>` | A main content band            |
| `main`               | `<main>`    | The primary content region     |

So a top-level frame named `Hero` becomes `<section>`. A nested frame named `name section` stays a `<div>`, because it is not a direct child of the page and `section` is only read at the top level.

## Buttons

Name a layer `button`, `btn`, or `cta` and it becomes a `<button>`. There is one guard: if the layer contains other buttons (a layer named `button row` holding two `button` layers), it stays a `<div>`, so you never end up with a button nested inside a button.

Links are automatic and need no name. If a text layer has a Figma hyperlink, it exports as an `<a>` with that URL.

## Lists, done right

To get a real list:

1. Name the container `list` or `menu`. It becomes `<ul>`.
2. Put each item as a direct child. Each one becomes `<li>`, whatever it is inside.

This is how a nav menu should be built: a `nav` frame holding a `menu` frame, with one child per link.

## A worked example

Here is a page frame and the tags it produces:

```text
Landing (selected frame)          →  the page body
├── Nav                           →  <nav>
│   └── Menu                      →  <ul>
│       ├── Link "Home"           →  <li> (with an <a> if it has a hyperlink)
│       ├── Link "Pricing"        →  <li>
│       └── Link "Docs"           →  <li>
├── Hero                          →  <section>   (top level, so it counts)
│   ├── Title "Ship faster"       →  <h1>        (see Headings and text)
│   ├── Body "One click ..."      →  <p>
│   └── CTA "Get started"         →  <button>
├── Features                      →  <section>
│   └── Card                      →  <div>
└── Footer                        →  <footer>
```

Names you do not recognize from the tables above stay neutral: containers become `<div>`, text becomes `<p>`. That is on purpose. It is better to leave a layer as a safe `<div>` than to guess wrong.

## What to name and what to skip

- **Do name** the landmarks: the nav, header, hero and content sections, aside, footer, any list, and your buttons.
- **You can skip** naming ordinary boxes and text. Generic containers are fine as `<div>`, and headings are detected by size, not by name (that is the [next page](/guide/headings-and-text)).

Next: [use auto layout](/guide/auto-layout) so these tags come out as flexbox instead of absolute boxes.
