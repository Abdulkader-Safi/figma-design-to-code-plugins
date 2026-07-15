// Walks the selected node tree and emits a self-contained HTML/CSS document.
// Maps auto-layout to flexbox, static frames/groups to absolute positioning, and
// pulls colours, typography, radius, borders, shadows.

import type { Rule } from "./types";
import { solidFill, linearGradient, escapeHtml, round } from "./values";
import { isAutoLayout, isVectorLike, isIconContainer, hasImageFill } from "./nodes";
import { headingMap, textTag, containerTag } from "./semantic";
import { positionAndSize, applyLayout } from "./layout";
import { applyBoxDecoration } from "./decoration";
import { styleRule, ALIGN } from "./text";
import { toTailwind } from "./tailwind";
import { fontLink, docShell } from "./document";

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
      ? solidFill(root.fills) || linearGradient(root.fills)
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
    let hasBefore = false; // set when this node gets a full-bleed ::before rule
    const absolute = parent !== null && !isAutoLayout(parent);
    // Direct children of a list become list items.
    const inList = parentTag === "ul" || parentTag === "ol";
    // Landmark bands (section/header/footer/main) only apply at the top level.
    const topBand = parent === root;

    positionAndSize(node, parent, absolute, rule);
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
    if (isVectorLike(node) || isIconContainer(node)) {
      let svg = "";
      try {
        svg = await node.exportAsync({ format: "SVG_STRING" });
      } catch {
        /* fall through to empty box */
      }
      return `${indent}<div class="${emitClass(cls, rule)}">${svg}</div>`;
    }

    // Image fills: export the node as a PNG and drop it in as an <img>.
    if (hasImageFill(node)) {
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
      const bg = rule.background;
      delete rule.background;
      delete rule.overflow;
      rule.position = "relative";
      rule["z-index"] = "0";
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

    const tag = inList
      ? "li"
      : opts.semantic
        ? containerTag(node, topBand)
        : "div";
    const kids = "children" in node ? node.children.slice() : [];
    if (kids.length === 0) {
      return `${indent}<${tag} class="${emitClass(cls, rule, hasBefore)}"></${tag}>`;
    }

    if (!isAutoLayout(node) && !rule.position) rule.position = "relative";
    const c = emitClass(cls, rule, hasBefore);

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
  const bodyRule = `body { display: flex; justify-content: center;${pageBg ? ` background: ${pageBg};` : ""} }`;

  // Tailwind mode: utilities live on the elements and the v4 browser CDN builds
  // the stylesheet at runtime (its preflight covers the resets). The only static
  // CSS left is the body centring and the full-bleed ::before rules, which have
  // no clean utility form.
  if (opts.tailwind) {
    const extra = [bodyRule, ...cssRules].join("\n\n");
    const head =
      `  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>\n` +
      `  <style>\n${extra.replace(/^/gm, "    ")}\n  </style>`;
    const doc = docShell(root.name, links, head, body);
    return { combined: doc, html: doc, css: "" };
  }

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
