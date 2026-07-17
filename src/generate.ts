// Walks the selected node tree and emits a self-contained HTML/CSS document.
// Maps auto-layout to flexbox, static frames/groups to absolute positioning, and
// pulls colours, typography, radius, borders, shadows.

import type { Rule } from "./types";
import { solidFill, gradientFill, escapeHtml, round } from "./values";
import {
  isAutoLayout,
  ignoresAutoLayout,
  isVectorLike,
  isIconContainer,
  hasImageFill,
  hugsText,
} from "./nodes";
import { headingMap, textTag, containerTag } from "./semantic";
import { positionAndSize, applyLayout } from "./layout";
import { applyBoxDecoration } from "./decoration";
import { styleRule, ALIGN } from "./text";
import { toTailwind, fontSlug } from "./tailwind";
import { fontLink, docShell } from "./document";
import { buildMergedTree } from "./merge-build";
import { emitMerged } from "./merge-emit";
import { parseFrameName, type FrameVariant } from "./responsive";

// A background value -> a Tailwind bg-[…] utility (a hex, or an arbitrary image
// like a gradient with spaces underscored).
function bgUtil(bg: string): string {
  return bg.startsWith("#") ? `bg-[${bg}]` : `bg-[${bg.replace(/\s+/g, "_")}]`;
}

// The full-viewport bleed as Tailwind before:* utilities (its pseudo-element
// variant) — the idiomatic form of the ::before bleed rule used in CSS mode.
function bleedBefore(bg: string): string {
  return (
    "before:content-[''] before:absolute before:z-[-1] before:inset-y-0 " +
    `before:left-1/2 before:w-screen before:-ml-[50vw] before:${bgUtil(bg)}`
  );
}

export async function generate(
  root: SceneNode,
  opts: { semantic: boolean; tailwind: boolean },
): Promise<{ combined: string; html: string; css: string }> {
  const cssRules: string[] = [];
  const fonts = new Map<string, Set<number>>(); // family -> weights
  let counter = 0;

  // The page width and background drive full-width sections: the surround gets
  // the page colour (no white gutters) and full-span bands bleed to both edges.
  const pageW = "width" in root ? Math.round(root.width) : 0;
  const pageBg =
    "fills" in root && Array.isArray(root.fills)
      ? solidFill(root.fills) || gradientFill(root.fills)
      : null;

  // Map heading font sizes -> h1..h6. The most common size is treated as body;
  // anything larger becomes a heading, ranked by size. Works with no layer names.
  const headings = opts.semantic ? headingMap(root) : new Map<number, string>();

  const className = (node: SceneNode): string => {
    const base =
      (node.name || node.type)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 28) || "node";
    return `${base}-${counter++}`;
  };

  const pushRule = (cls: string, rule: Rule) => {
    const body = Object.keys(rule)
      .map((k) => `  ${k}: ${rule[k]};`)
      .join("\n");
    if (body) cssRules.push(`.${cls} {\n${body}\n}`);
  };

  // Returns the value for a class="" attribute. In CSS mode it registers the rule
  // and returns the class name. In Tailwind mode it returns utility classes; when
  // keepClass is set (a section with a ::before bleed) it keeps the class name too
  // so the generated ::before rule still has a selector to target.
  const emitClass = (cls: string, rule: Rule, keepClass = false): string => {
    if (!opts.tailwind) {
      pushRule(cls, rule);
      return cls;
    }
    const tw = toTailwind(rule);
    if (keepClass) return tw ? `${cls} ${tw}` : cls;
    return tw;
  };

  const addFont = (family: string, weight: number) => {
    if (!fonts.has(family)) fonts.set(family, new Set());
    fonts.get(family)!.add(weight);
  };

  async function build(
    node: SceneNode,
    parent: SceneNode | null,
    depth: number,
    parentTag: string,
    interactive: boolean,
  ): Promise<string> {
    if ("visible" in node && node.visible === false) return "";

    const cls = className(node);
    const indent = "  ".repeat(depth);
    const rule: Rule = {};
    let hasBefore = false; // CSS mode: this node gets a full-bleed ::before rule
    let beforeUtils = ""; // Tailwind mode: the same bleed as before:* utilities
    // Out of the flow either because the parent has no auto-layout at all, or
    // because this child opted out of it ("Ignore auto layout" in Figma).
    const absolute =
      parent !== null && (!isAutoLayout(parent) || ignoresAutoLayout(node));
    // Direct children of a list become list items.
    const inList = parentTag === "ul" || parentTag === "ol";
    // Landmark bands (section/header/footer/main) only apply at the top level.
    const topBand = parent === root;
    // Exported whole as one asset, so any rotation is baked into the asset.
    const asSvg = isVectorLike(node) || isIconContainer(node);
    const asImg = !asSvg && hasImageFill(node);

    positionAndSize(node, parent, absolute, asSvg || asImg, rule);
    if (
      "opacity" in node &&
      typeof node.opacity === "number" &&
      node.opacity < 1
    ) {
      rule.opacity = round(node.opacity);
    }

    // Vectors and icons: inline the SVG, crisp and small. A container made only
    // of vector art (icon strokes, a glyph on a shape) is exported whole as one
    // SVG so multi-part icons render as designed instead of as broken pieces.
    if (asSvg) {
      let svg = "";
      try {
        svg = await node.exportAsync({ format: "SVG_STRING" });
      } catch {
        /* fall through to empty box */
      }
      return `${indent}<div class="${emitClass(cls, rule)}">${svg}</div>`;
    }

    // Image fills: export the node as a PNG and drop it in as an <img>.
    if (asImg) {
      applyBoxDecoration(node, rule);
      try {
        const bytes = await node.exportAsync({
          format: "PNG",
          constraint: { type: "SCALE", value: 2 },
        });
        const b64 = figma.base64Encode(bytes);
        rule["object-fit"] = "cover";
        return `${indent}<img class="${emitClass(cls, rule)}" src="data:image/png;base64,${b64}" alt="${escapeHtml(node.name)}" />`;
      } catch {
        return `${indent}<div class="${emitClass(cls, rule)}"></div>`;
      }
    }

    // Text.
    if (node.type === "TEXT") {
      // An "Auto width" box was measured off the glyphs, so it fits the line
      // exactly and has no slack. The browser measures text a hair differently
      // (a 165px box here wants 167.6px), so pinning Figma's width wraps the
      // line and spills it out of the pinned height. Figma isn't holding this
      // box to a size either: let it fit its own text, and never wrap.
      if (hugsText(node)) {
        delete rule.width;
        delete rule.height;
        rule["white-space"] = "nowrap";
      }
      // Node-level alignment always; font/size/color per segment below.
      rule["text-align"] = ALIGN[node.textAlignHorizontal] || "left";

      const segments = node.getStyledTextSegments([
        "fontName",
        "fontSize",
        "fills",
        "textDecoration",
        "textCase",
        "letterSpacing",
        "lineHeight",
      ]);

      let inner: string;
      if (segments.length <= 1) {
        styleRule(node, rule, addFont); // uniform text
        inner = escapeHtml(node.characters).replace(/\n/g, "<br>");
      } else {
        // Mixed styling in one text node: one <span> per run.
        inner = segments
          .map((seg, i) => {
            const scls = `${cls}-r${i}`;
            const srule: Rule = {};
            styleRule(seg, srule, addFont);
            return `<span class="${emitClass(scls, srule)}">${escapeHtml(seg.characters).replace(/\n/g, "<br>")}</span>`;
          })
          .join("");
      }

      const c = emitClass(cls, rule);
      const tag = inList
        ? "li"
        : opts.semantic
          ? textTag(node, headings, interactive)
          : "p";
      if (tag === "a") {
        const link = node.hyperlink;
        const href =
          link && typeof link === "object" ? escapeHtml(link.value) : "#";
        return `${indent}<a class="${c}" href="${href}">${inner}</a>`;
      }
      return `${indent}<${tag} class="${c}">${inner}</${tag}>`;
    }

    // Containers and shapes.
    applyBoxDecoration(node, rule);
    applyLayout(node, rule);

    // The page root must not clip: a fixed-width overflow:hidden root would trap
    // every full-width section inside the design column and cancel the bleed.
    if (parent === null) delete rule.overflow;

    // Any section that spans the page paints its background across the full
    // viewport (content stays in the centred column) so it reaches both screen
    // edges instead of leaving gutters. Works at any nesting depth, since the
    // design is centred, so a full-width band is always centred in the viewport.
    // Skipped for the root, and for bordered bands or narrower left-aligned
    // blocks. A qualifying band drops its own clip so the bleed can escape it.
    if (
      parent !== null &&
      rule.background &&
      "width" in node &&
      node.width >= pageW * 0.98 &&
      !Object.keys(rule).some((k) => k.startsWith("border"))
    ) {
      const bg = String(rule.background);
      delete rule.background;
      delete rule.overflow;
      rule.position = "relative";
      rule["z-index"] = "0";
      if (opts.tailwind) {
        beforeUtils = bleedBefore(bg);
      } else {
        hasBefore = true;
        cssRules.push(
          `.${cls}::before {\n` +
            `  content: "";\n` +
            `  position: absolute;\n` +
            `  z-index: -1;\n` +
            `  top: 0;\n` +
            `  bottom: 0;\n` +
            `  left: 50%;\n` +
            `  width: 100vw;\n` +
            `  margin-left: -50vw;\n` +
            `  background: ${bg};\n` +
            `}`,
        );
      }
    }

    // Class attribute for this container: the utility/class output plus, in
    // Tailwind mode, the before:* bleed utilities.
    const withBleed = (base: string) =>
      beforeUtils ? `${base} ${beforeUtils}` : base;

    const tag = inList
      ? "li"
      : opts.semantic
        ? containerTag(node, topBand)
        : "div";
    const kids = "children" in node ? node.children.slice() : [];
    if (kids.length === 0) {
      return `${indent}<${tag} class="${withBleed(emitClass(cls, rule, hasBefore))}"></${tag}>`;
    }

    // An absolutely-placed child measures left/top from its nearest positioned
    // ancestor, so any box holding one has to be that ancestor: a static frame
    // (all its children are absolute) and an auto-layout frame holding an
    // "ignore auto layout" child. Without this the child escapes to whatever
    // outer box happens to be positioned and lands far from where it was drawn.
    const anchors = !isAutoLayout(node) || kids.some(ignoresAutoLayout);
    if (anchors && !rule.position) rule.position = "relative";
    const c = withBleed(emitClass(cls, rule, hasBefore));

    const childInteractive = interactive || tag === "a" || tag === "button";
    const childHtml: string[] = [];
    for (const child of kids) {
      const h = await build(child, node, depth + 1, tag, childInteractive);
      if (h) childHtml.push(h);
    }
    return `${indent}<${tag} class="${c}">\n${childHtml.join("\n")}\n${indent}</${tag}>`;
  }

  const body = await build(root, null, 3, "", false);
  const links = fontLink(fonts);

  // Tailwind mode: every style is a utility. The v4 browser CDN builds the
  // stylesheet at runtime (its preflight covers the resets). The only non-utility
  // CSS is the @theme fonts and the line-height reset, both Tailwind config.
  if (opts.tailwind) {
    // Fonts become a @theme block so text nodes can use idiomatic font-*
    // utilities (font-inter, font-space-grotesk) instead of an arbitrary
    // [font-family:…]. The v4 browser CDN reads config from a
    // <style type="text/tailwindcss"> block.
    const themeVars = Array.from(fonts.keys())
      .map((fam) => `    --font-${fontSlug(fam)}: '${fam}', sans-serif;`)
      .join("\n");
    const theme = fonts.size ? `  @theme {\n${themeVars}\n  }\n` : "";
    // Tailwind's Preflight sets a base line-height (1.5) the plain-CSS reset
    // never had, which loosens every AUTO (unset) line-height and drifts from
    // the design. Reset to normal in @layer base so the utilities layer's
    // explicit leading-[…] still wins; only AUTO nodes fall back to normal.
    const twConfig = `${theme}  @layer base { * { line-height: normal; } }`;
    const bodyClass = `flex justify-center${pageBg ? ` ${bgUtil(pageBg)}` : ""}`;
    const head =
      `  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>\n` +
      `  <style type="text/tailwindcss">\n${twConfig}\n  </style>`;
    const doc = docShell(root.name, links, head, body, bodyClass);
    return { combined: doc, html: doc, css: "" };
  }

  const bodyRule = `body { display: flex; justify-content: center;${pageBg ? ` background: ${pageBg};` : ""} }`;

  const stylesheet =
    "* { margin: 0; padding: 0; box-sizing: border-box; }\n" +
    // Strip user-agent chrome so a semantic <button>/<a> is painted only by the
    // node's own styles (no buttonface fill, no outset border, no link blue).
    "a { color: inherit; text-decoration: none; }\n" +
    "button { font: inherit; color: inherit; text-align: inherit; background: none; border: 0; cursor: pointer; -webkit-appearance: none; appearance: none; }\n" +
    bodyRule +
    "\n\n" +
    cssRules.join("\n\n");

  const styleBlock = `  <style>\n${stylesheet.replace(/^/gm, "    ")}\n  </style>`;
  const linkBlock = `  <link rel="stylesheet" href="styles.css" />`;

  return {
    combined: docShell(root.name, links, styleBlock, body),
    html: docShell(root.name, links, linkBlock, body),
    css: stylesheet,
  };
}

// Export a responsive set: overlay the variant frames into one merged tree, then
// serialise it with per-breakpoint CSS or Tailwind. Fonts accumulate across all
// frames; the page background and title come from the base (smallest) frame.
export async function generateResponsive(
  variants: FrameVariant[],
  opts: { semantic: boolean; tailwind: boolean },
): Promise<{ combined: string; html: string; css: string }> {
  const fonts = new Map<string, Set<number>>();
  const addFont = (family: string, weight: number) => {
    if (!fonts.has(family)) fonts.set(family, new Set());
    fonts.get(family)!.add(weight);
  };

  const base = variants[0].frame;
  const pageBg =
    "fills" in base && Array.isArray(base.fills)
      ? solidFill(base.fills) || gradientFill(base.fills)
      : null;

  const tree = await buildMergedTree(variants, { semantic: opts.semantic }, addFont);
  return emitMerged(tree, {
    title: parseFrameName(base.name).prefix || base.name,
    tailwind: opts.tailwind,
    fonts,
    pageBg,
  });
}

// The style, tag, and content a node would get in single-frame export, computed
// standalone so the responsive builder can style the same node in any frame.
export interface NodeStyle {
  rule: Rule;
  tag: string;
  kind: "element" | "text" | "asset";
  asset?: string; // SVG string (kind asset, tag div) or img attributes (tag img)
  text?: string; // text characters (kind text)
  href?: string; // link target when tag is "a"
  bleedBg?: string; // full-viewport bleed background; the emitter paints it
}

export interface NodeCtx {
  headings: Map<number, string>;
  semantic: boolean;
  addFont: (family: string, weight: number) => void;
  pageW: number; // the containing frame's width, for full-bleed detection
  topBand: boolean; // parent is the frame root (landmark bands apply)
  inList: boolean; // parent is ul/ol (children become li)
  interactive: boolean; // inside an a/button (text links are suppressed)
}

// Mirror of build()'s per-node computation, without emitting HTML. build() is
// intentionally left untouched so single-frame output stays byte-identical; keep
// this in step with it. Returns null for a hidden node. `text` is returned as
// ready-to-place HTML (escaped, mixed runs as inline-styled spans). When
// exportAssets is false the SVG/PNG export is skipped: the merge only keeps one
// frame's asset, so the others need the rule, not the pixels.
export async function nodeRule(
  node: SceneNode,
  parent: SceneNode | null,
  ctx: NodeCtx,
  exportAssets = true,
): Promise<NodeStyle | null> {
  if ("visible" in node && node.visible === false) return null;

  const rule: Rule = {};
  const absolute =
    parent !== null && (!isAutoLayout(parent) || ignoresAutoLayout(node));
  const asSvg = isVectorLike(node) || isIconContainer(node);
  const asImg = !asSvg && hasImageFill(node);

  positionAndSize(node, parent, absolute, asSvg || asImg, rule);
  if (
    "opacity" in node &&
    typeof node.opacity === "number" &&
    node.opacity < 1
  ) {
    rule.opacity = round(node.opacity);
  }

  if (asSvg) {
    let svg = "";
    if (exportAssets) {
      try {
        svg = await node.exportAsync({ format: "SVG_STRING" });
      } catch {
        /* fall through to empty box */
      }
    }
    return { rule, tag: "div", kind: "asset", asset: svg };
  }

  if (asImg) {
    applyBoxDecoration(node, rule);
    rule["object-fit"] = "cover";
    if (!exportAssets) return { rule, tag: "img", kind: "asset", asset: "" };
    try {
      const bytes = await node.exportAsync({
        format: "PNG",
        constraint: { type: "SCALE", value: 2 },
      });
      const b64 = figma.base64Encode(bytes);
      return {
        rule,
        tag: "img",
        kind: "asset",
        asset: `src="data:image/png;base64,${b64}" alt="${escapeHtml(node.name)}"`,
      };
    } catch {
      return { rule, tag: "div", kind: "element" };
    }
  }

  if (node.type === "TEXT") {
    if (hugsText(node)) {
      delete rule.width;
      delete rule.height;
      rule["white-space"] = "nowrap";
    }
    rule["text-align"] = ALIGN[node.textAlignHorizontal] || "left";
    const tag = ctx.inList
      ? "li"
      : ctx.semantic
        ? textTag(node, ctx.headings, ctx.interactive)
        : "p";
    let href: string | undefined;
    if (tag === "a") {
      const link = node.hyperlink;
      href = link && typeof link === "object" ? escapeHtml(link.value) : "#";
    }

    const segments = node.getStyledTextSegments([
      "fontName",
      "fontSize",
      "fills",
      "textDecoration",
      "textCase",
      "letterSpacing",
      "lineHeight",
    ]);
    let text: string;
    if (segments.length <= 1) {
      styleRule(node, rule, ctx.addFont); // uniform text: style the whole node
      text = escapeHtml(node.characters).replace(/\n/g, "<br>");
    } else {
      // Mixed styling: one inline-styled span per run, so colours and sizes
      // survive without a class per segment (the merge would clash on those).
      text = segments
        .map((seg) => {
          const srule: Rule = {};
          styleRule(seg, srule, ctx.addFont);
          const style = Object.keys(srule)
            .map((k) => `${k}:${srule[k]}`)
            .join(";");
          const inner = escapeHtml(seg.characters).replace(/\n/g, "<br>");
          return `<span style="${style}">${inner}</span>`;
        })
        .join("");
    }
    return { rule, tag, kind: "text", text, href };
  }

  applyBoxDecoration(node, rule);
  applyLayout(node, rule);
  if (parent === null) delete rule.overflow;

  let bleedBg: string | undefined;
  if (
    parent !== null &&
    rule.background &&
    "width" in node &&
    node.width >= ctx.pageW * 0.98 &&
    !Object.keys(rule).some((k) => k.startsWith("border"))
  ) {
    bleedBg = String(rule.background);
    delete rule.background;
    delete rule.overflow;
    rule.position = "relative";
    rule["z-index"] = "0";
  }

  const kids = "children" in node ? node.children.slice() : [];
  const anchors = !isAutoLayout(node) || kids.some(ignoresAutoLayout);
  if (kids.length && anchors && !rule.position) rule.position = "relative";

  const tag = ctx.inList
    ? "li"
    : ctx.semantic
      ? containerTag(node, ctx.topBand)
      : "div";
  return { rule, tag, kind: "element", bleedBg };
}
