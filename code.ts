// Design to HTML — exports the selected Figma frame to a self-contained HTML/CSS file.
// Maps auto-layout to flexbox, static frames/groups to absolute positioning, and
// pulls colors, typography, radius, borders, shadows. Fonts used by text nodes are
// emitted as a Google Fonts <link> (non-Google families just fall back gracefully).

figma.showUI(__html__, { width: 480, height: 660, themeColors: true });

figma.ui.onmessage = async (msg: { type: string; semantic?: boolean }) => {
  if (msg.type !== "export") return;

  const sel = figma.currentPage.selection;
  const root = sel.find(
    (n) =>
      n.type === "FRAME" ||
      n.type === "COMPONENT" ||
      n.type === "INSTANCE" ||
      n.type === "GROUP",
  );
  if (!root) {
    figma.ui.postMessage({
      type: "error",
      message: "Select a frame, component, or group to export.",
    });
    return;
  }

  try {
    const out = await generate(root, { semantic: msg.semantic !== false });
    figma.ui.postMessage({
      type: "result",
      name: sanitizeFileName(root.name),
      combined: out.combined,
      html: out.html,
      css: out.css,
    });
  } catch (e) {
    figma.ui.postMessage({
      type: "error",
      message: "Export failed: " + (e as Error).message,
    });
  }
};

// --- generation --------------------------------------------------------------

type Rule = { [prop: string]: string | number };

async function generate(
  root: SceneNode,
  opts: { semantic: boolean },
): Promise<{ combined: string; html: string; css: string }> {
  const cssRules: string[] = [];
  const fonts = new Map<string, Set<number>>(); // family -> weights
  let counter = 0;

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

    // Vectors and icons: inline the SVG, crisp and small.
    if (isVectorLike(node)) {
      let svg = "";
      try {
        svg = await node.exportAsync({ format: "SVG_STRING" });
      } catch {
        /* fall through to empty box */
      }
      pushRule(cls, rule);
      return `${indent}<div class="${cls}">${svg}</div>`;
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
        pushRule(cls, rule);
        return `${indent}<img class="${cls}" src="data:image/png;base64,${b64}" alt="${escapeHtml(node.name)}" />`;
      } catch {
        pushRule(cls, rule);
        return `${indent}<div class="${cls}"></div>`;
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
            pushRule(scls, srule);
            return `<span class="${scls}">${escapeHtml(seg.characters).replace(/\n/g, "<br>")}</span>`;
          })
          .join("");
      }

      pushRule(cls, rule);
      const tag = inList
        ? "li"
        : opts.semantic
          ? textTag(node, headings, interactive)
          : "p";
      if (tag === "a") {
        const link = node.hyperlink;
        const href =
          link && typeof link === "object" ? escapeHtml(link.value) : "#";
        return `${indent}<a class="${cls}" href="${href}">${inner}</a>`;
      }
      return `${indent}<${tag} class="${cls}">${inner}</${tag}>`;
    }

    // Containers and shapes.
    applyBoxDecoration(node, rule);
    applyLayout(node, rule);

    const tag = inList
      ? "li"
      : opts.semantic
        ? containerTag(node, topBand)
        : "div";
    const kids = "children" in node ? node.children.slice() : [];
    if (kids.length === 0) {
      pushRule(cls, rule);
      return `${indent}<${tag} class="${cls}"></${tag}>`;
    }

    if (!isAutoLayout(node) && !rule.position) rule.position = "relative";
    pushRule(cls, rule);

    const childInteractive = interactive || tag === "a" || tag === "button";
    const childHtml: string[] = [];
    for (const child of kids) {
      const h = await build(child, node, depth + 1, tag, childInteractive);
      if (h) childHtml.push(h);
    }
    return `${indent}<${tag} class="${cls}">\n${childHtml.join("\n")}\n${indent}</${tag}>`;
  }

  const body = await build(root, null, 3, "", false);
  const links = fontLink(fonts);
  const stylesheet =
    "* { margin: 0; padding: 0; box-sizing: border-box; }\n" +
    // Strip user-agent chrome so a semantic <button>/<a> is painted only by the
    // node's own styles (no buttonface fill, no outset border, no link blue).
    "a { color: inherit; text-decoration: none; }\n" +
    "button { font: inherit; color: inherit; text-align: inherit; background: none; border: 0; cursor: pointer; -webkit-appearance: none; appearance: none; }\n" +
    "body { display: flex; justify-content: center; }\n\n" +
    cssRules.join("\n\n");

  const styleBlock = `  <style>\n${stylesheet.replace(/^/gm, "    ")}\n  </style>`;
  const linkBlock = `  <link rel="stylesheet" href="styles.css" />`;

  return {
    combined: docShell(root.name, links, styleBlock, body),
    html: docShell(root.name, links, linkBlock, body),
    css: stylesheet,
  };
}

// --- node helpers ------------------------------------------------------------

const isAutoLayout = (n: SceneNode): boolean =>
  "layoutMode" in n && n.layoutMode !== "NONE";

const isVectorLike = (n: SceneNode): boolean =>
  n.type === "VECTOR" ||
  n.type === "BOOLEAN_OPERATION" ||
  n.type === "STAR" ||
  n.type === "LINE" ||
  n.type === "POLYGON";

const hasImageFill = (n: SceneNode): boolean =>
  "fills" in n &&
  Array.isArray(n.fills) &&
  n.fills.some((f) => f.visible !== false && f.type === "IMAGE");

// --- semantic tag resolution -------------------------------------------------
// All heuristics are offline and deliberately conservative: a node only leaves
// the neutral <div>/<p> when a signal is strong, so a wrong guess never wins
// over the safe default and the markup stays valid.

const HEADING_LEVELS = 4; // never emit past h4
const HEADING_RATIO = 1.2; // a heading must be at least 20% larger than body
const HEADING_MAX_CHARS = 40; // headings are short; long text stays a paragraph

// The most common text size is treated as body. Only the few sizes clearly
// larger than body become headings (h1..h4), so body copy is never promoted.
function headingMap(root: SceneNode): Map<number, string> {
  const sizes: number[] = [];
  const walk = (n: SceneNode) => {
    if ("visible" in n && n.visible === false) return;
    if (n.type === "TEXT" && typeof n.fontSize === "number") {
      sizes.push(Math.round(n.fontSize));
    }
    if ("children" in n) n.children.forEach(walk);
  };
  walk(root);

  const map = new Map<number, string>();
  if (sizes.length === 0) return map;

  const freq = new Map<number, number>();
  sizes.forEach((s) => freq.set(s, (freq.get(s) || 0) + 1));
  let body = sizes[0];
  let best = -1;
  freq.forEach((count, size) => {
    if (count > best || (count === best && size < body)) {
      best = count;
      body = size;
    }
  });

  Array.from(new Set(sizes))
    .filter((s) => s >= body * HEADING_RATIO)
    .sort((a, b) => b - a)
    .slice(0, HEADING_LEVELS)
    .forEach((s, i) => map.set(s, "h" + (i + 1)));
  return map;
}

function textTag(
  node: TextNode,
  headings: Map<number, string>,
  interactive: boolean,
): string {
  const link = node.hyperlink;
  if (!interactive && link && typeof link === "object" && link.type === "URL") {
    return "a";
  }
  // Only short text at a heading size becomes a heading; paragraphs stay <p>.
  if (typeof node.fontSize === "number") {
    const h = headings.get(Math.round(node.fontSize));
    if (h && node.characters.length <= HEADING_MAX_CHARS && !node.characters.includes("\n")) {
      return h;
    }
  }
  return "p";
}

// Keywords that read reliably from a layer name at any depth.
const INLINE_TAGS: [RegExp, string][] = [
  [/\b(nav|navbar|navigation)\b/, "nav"],
  [/\bfooter\b/, "footer"],
  [/\b(aside|sidebar)\b/, "aside"],
  [/\b(article|blog\s*post)\b/, "article"],
  [/\b(list|menu)\b/, "ul"],
];
// "section" and "main" are common words in group names, so they only count for
// the page's top-level bands, not for nested groups like "name section".
const BAND_TAGS: [RegExp, string][] = [
  [/\bheader\b/, "header"],
  [/\b(section|hero)\b/, "section"],
  [/\bmain\b/, "main"],
];
const BUTTON_NAME = /\b(button|btn|cta)\b/;

function containerTag(node: SceneNode, topBand: boolean): string {
  const name = (node.name || "").toLowerCase();
  for (const [re, tag] of INLINE_TAGS) if (re.test(name)) return tag;
  if (topBand) for (const [re, tag] of BAND_TAGS) if (re.test(name)) return tag;
  // A button, only from its name, and never when it actually wraps buttons
  // (e.g. a "button row"), which would nest a button inside a button.
  if (BUTTON_NAME.test(name) && !wrapsButton(node)) return "button";
  return "div";
}

// True if a descendant looks like a button by name, meaning this node is a
// container of buttons rather than a button itself.
function wrapsButton(node: SceneNode): boolean {
  if (!("children" in node)) return false;
  return node.children.some(
    (c) => BUTTON_NAME.test((c.name || "").toLowerCase()) || wrapsButton(c),
  );
}

function positionAndSize(
  node: SceneNode,
  parent: SceneNode | null,
  absolute: boolean,
  rule: Rule,
) {
  const w = "width" in node ? Math.round(node.width) : undefined;
  const h = "height" in node ? Math.round(node.height) : undefined;

  if (parent === null) {
    rule.position = "relative";
    rule.margin = "0 auto";
    if (w !== undefined) rule.width = `${w}px`;
    if (h !== undefined) rule.height = `${h}px`;
    return;
  }

  if (absolute) {
    rule.position = "absolute";
    rule.left = `${Math.round(node.x)}px`;
    rule.top = `${Math.round(node.y)}px`;
    if (w !== undefined) rule.width = `${w}px`;
    if (h !== undefined) rule.height = `${h}px`;
    return;
  }

  // In an auto-layout parent: honour Figma's hug / fill / fixed sizing.
  const hParent = "layoutMode" in parent && parent.layoutMode === "HORIZONTAL";
  const vParent = "layoutMode" in parent && parent.layoutMode === "VERTICAL";
  const hSize = (
    "layoutSizingHorizontal" in node ? node.layoutSizingHorizontal : "FIXED"
  ) as string;
  const vSize = (
    "layoutSizingVertical" in node ? node.layoutSizingVertical : "FIXED"
  ) as string;

  if (hSize === "FILL")
    rule[hParent ? "flex" : "align-self"] = hParent ? "1 1 0" : "stretch";
  else if (hSize === "FIXED" && w !== undefined) rule.width = `${w}px`;

  if (vSize === "FILL")
    rule[vParent ? "flex" : "align-self"] = vParent ? "1 1 0" : "stretch";
  else if (vSize === "FIXED" && h !== undefined) rule.height = `${h}px`;
}

function applyLayout(node: SceneNode, rule: Rule) {
  if (!isAutoLayout(node)) return;
  const n = node as FrameNode;
  rule.display = "flex";
  rule["flex-direction"] = n.layoutMode === "VERTICAL" ? "column" : "row";

  const pad = [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft];
  if (pad.some((p) => p > 0))
    rule.padding = pad.map((p) => `${Math.round(p)}px`).join(" ");

  const primary: { [k: string]: string } = {
    MIN: "flex-start",
    CENTER: "center",
    MAX: "flex-end",
    SPACE_BETWEEN: "space-between",
  };
  const counter: { [k: string]: string } = {
    MIN: "flex-start",
    CENTER: "center",
    MAX: "flex-end",
    BASELINE: "baseline",
  };
  rule["justify-content"] = primary[n.primaryAxisAlignItems] || "flex-start";
  rule["align-items"] = counter[n.counterAxisAlignItems] || "flex-start";

  if (n.primaryAxisAlignItems !== "SPACE_BETWEEN" && n.itemSpacing > 0)
    rule.gap = `${Math.round(n.itemSpacing)}px`;
  if (n.clipsContent) rule.overflow = "hidden";
}

function applyBoxDecoration(node: SceneNode, rule: Rule) {
  // Background.
  if ("fills" in node && Array.isArray(node.fills)) {
    const bg = solidFill(node.fills) || linearGradient(node.fills);
    if (bg) rule.background = bg;
  }

  // Corner radius.
  if (node.type === "ELLIPSE") {
    rule["border-radius"] = "50%";
  } else if ("cornerRadius" in node) {
    const cr = node.cornerRadius;
    if (typeof cr === "number" && cr > 0)
      rule["border-radius"] = `${Math.round(cr)}px`;
    else if (cr === figma.mixed && "topLeftRadius" in node) {
      const c = node as RectangleNode;
      rule["border-radius"] =
        `${c.topLeftRadius}px ${c.topRightRadius}px ${c.bottomRightRadius}px ${c.bottomLeftRadius}px`;
    }
  }

  // Border.
  if ("strokes" in node && Array.isArray(node.strokes)) {
    const s = node.strokes.find(
      (x) => x.visible !== false && x.type === "SOLID",
    ) as SolidPaint | undefined;
    if (s) {
      const color = rgba(s.color, s.opacity);
      if ("strokeTopWeight" in node) {
        // Figma allows per-side stroke weights; honour each side so a bottom-only
        // rule doesn't become a full box.
        const t = Math.round(node.strokeTopWeight);
        const r = Math.round(node.strokeRightWeight);
        const b = Math.round(node.strokeBottomWeight);
        const l = Math.round(node.strokeLeftWeight);
        if (t === r && r === b && b === l) {
          if (t > 0) rule.border = `${t}px solid ${color}`;
        } else {
          if (t > 0) rule["border-top"] = `${t}px solid ${color}`;
          if (r > 0) rule["border-right"] = `${r}px solid ${color}`;
          if (b > 0) rule["border-bottom"] = `${b}px solid ${color}`;
          if (l > 0) rule["border-left"] = `${l}px solid ${color}`;
        }
      } else {
        const w = typeof node.strokeWeight === "number" ? node.strokeWeight : 1;
        if (w > 0) rule.border = `${w}px solid ${color}`;
      }
    }
  }

  // Shadows.
  if ("effects" in node && Array.isArray(node.effects)) {
    const shadows = node.effects
      .filter(
        (e) =>
          e.visible !== false &&
          (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW"),
      )
      .map((e) => {
        const inset = e.type === "INNER_SHADOW" ? "inset " : "";
        const s = e as DropShadowEffect;
        return `${inset}${Math.round(s.offset.x)}px ${Math.round(s.offset.y)}px ${Math.round(s.radius)}px ${Math.round(s.spread || 0)}px ${rgba(s.color, s.color.a)}`;
      });
    if (shadows.length) rule["box-shadow"] = shadows.join(", ");
  }
}

// Fields shared by a TextNode and one styled segment. On the node these can be
// figma.mixed; on a segment they are always concrete.
type TextStyleSource = {
  fontName: FontName | PluginAPI["mixed"];
  fontSize: number | PluginAPI["mixed"];
  fills: ReadonlyArray<Paint> | PluginAPI["mixed"];
  lineHeight: LineHeight | PluginAPI["mixed"];
  letterSpacing: LetterSpacing | PluginAPI["mixed"];
  textCase: TextCase | PluginAPI["mixed"];
  textDecoration: TextDecoration | PluginAPI["mixed"];
};

// Font, size, color, and inline text properties. Anything mixed is skipped, so
// this works for a uniform node and for a single styled segment alike.
function styleRule(
  src: TextStyleSource,
  rule: Rule,
  addFont: (family: string, weight: number) => void,
) {
  const fn = src.fontName;
  if (fn !== figma.mixed) {
    const weight = styleToWeight(fn.style);
    rule["font-family"] = `'${fn.family}', sans-serif`;
    rule["font-weight"] = weight;
    if (fn.style.toLowerCase().includes("italic"))
      rule["font-style"] = "italic";
    addFont(fn.family, weight);
  }

  if (src.fontSize !== figma.mixed)
    rule["font-size"] = `${Math.round(src.fontSize)}px`;

  const color = solidFill(src.fills);
  if (color) rule.color = color;

  const lh = src.lineHeight;
  if (lh !== figma.mixed && lh.unit !== "AUTO") {
    rule["line-height"] =
      lh.unit === "PIXELS"
        ? `${Math.round(lh.value)}px`
        : `${round(lh.value / 100)}`;
  }

  const ls = src.letterSpacing;
  if (ls !== figma.mixed && ls.value !== 0) {
    rule["letter-spacing"] =
      ls.unit === "PERCENT"
        ? `${round(ls.value / 100)}em`
        : `${round(ls.value)}px`;
  }

  const tcase: { [k: string]: string } = {
    UPPER: "uppercase",
    LOWER: "lowercase",
    TITLE: "capitalize",
  };
  if (src.textCase !== figma.mixed && tcase[src.textCase])
    rule["text-transform"] = tcase[src.textCase];

  if (src.textDecoration === "UNDERLINE")
    rule["text-decoration"] = "underline";
  else if (src.textDecoration === "STRIKETHROUGH")
    rule["text-decoration"] = "line-through";
}

const ALIGN: { [k: string]: string } = {
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
  JUSTIFIED: "justify",
};

// --- value converters --------------------------------------------------------

function solidFill(
  fills: readonly Paint[] | typeof figma.mixed,
): string | null {
  if (!Array.isArray(fills)) return null;
  const f = fills.find((x) => x.visible !== false && x.type === "SOLID") as
    SolidPaint | undefined;
  return f ? rgba(f.color, f.opacity) : null;
}

function linearGradient(
  fills: readonly Paint[] | typeof figma.mixed,
): string | null {
  if (!Array.isArray(fills)) return null;
  const g = fills.find(
    (x) => x.visible !== false && x.type === "GRADIENT_LINEAR",
  ) as GradientPaint | undefined;
  if (!g) return null;
  const stops = g.gradientStops
    .map((s) => `${rgba(s.color, s.color.a)} ${Math.round(s.position * 100)}%`)
    .join(", ");
  return `linear-gradient(180deg, ${stops})`; // ponytail: fixed 180deg; read gradientTransform for exact angle if needed
}

function rgba(c: RGB | RGBA, opacity?: number): string {
  const a = opacity !== undefined ? opacity : "a" in c ? (c as RGBA).a : 1;
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  if (a >= 1) {
    const hex = (n: number) => n.toString(16).padStart(2, "0");
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }
  return `rgba(${r}, ${g}, ${b}, ${round(a)})`;
}

function styleToWeight(style: string): number {
  const s = style.toLowerCase();
  if (s.includes("thin")) return 100;
  if (s.includes("extra light") || s.includes("ultra light")) return 200;
  if (s.includes("semi bold") || s.includes("demi bold")) return 600;
  if (s.includes("extra bold") || s.includes("ultra bold")) return 800;
  if (s.includes("black") || s.includes("heavy")) return 900;
  if (s.includes("medium")) return 500;
  if (s.includes("light")) return 300;
  if (s.includes("bold")) return 700;
  return 400;
}

// --- document assembly -------------------------------------------------------

function fontLink(fonts: Map<string, Set<number>>): string {
  if (fonts.size === 0) return "";
  const families = Array.from(fonts.entries())
    .map(
      ([fam, weights]) =>
        `family=${fam.replace(/ /g, "+")}:wght@${Array.from(weights)
          .sort((a, b) => a - b)
          .join(";")}`,
    )
    .join("&");
  return (
    `<link rel="preconnect" href="https://fonts.googleapis.com">\n` +
    `  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n` +
    `  <link href="https://fonts.googleapis.com/css2?${families}&display=swap" rel="stylesheet">`
  );
}

function docShell(title: string, links: string, head: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${links}
${head}
</head>
<body>
${body}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sanitizeFileName(name: string): string {
  return (
    (name || "export")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "export"
  );
}

const round = (n: number): number => Math.round(n * 100) / 100;
