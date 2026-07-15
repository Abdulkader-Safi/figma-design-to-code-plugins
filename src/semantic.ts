// Semantic tag resolution. All heuristics are offline and deliberately
// conservative: a node only leaves the neutral <div>/<p> when a signal is
// strong, so a wrong guess never wins over the safe default and the markup
// stays valid.

const HEADING_LEVELS = 4; // never emit past h4
const HEADING_RATIO = 1.2; // a heading must be at least 20% larger than body
const HEADING_MAX_CHARS = 40; // headings are short; long text stays a paragraph

// The most common text size is treated as body. Only the few sizes clearly
// larger than body become headings (h1..h4), so body copy is never promoted.
export function headingMap(root: SceneNode): Map<number, string> {
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

export function textTag(
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
    if (
      h &&
      node.characters.length <= HEADING_MAX_CHARS &&
      !node.characters.includes("\n")
    ) {
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

export function containerTag(node: SceneNode, topBand: boolean): string {
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
