// Serialise a merged tree to a self-contained responsive document. Pure: no
// Figma runtime. CSS mode emits a base rule plus per-breakpoint @media diffs;
// Tailwind mode emits base utilities plus token-prefixed diff utilities. The
// document shell, resets, and font wiring match the single-frame generator so
// the two exports stay consistent.

import type { Rule } from "./types";
import type { Token } from "./breakpoints";
import { STANDARD } from "./breakpoints";
import { type MergedNode, cascadeDiff, displayTransitions } from "./merge-model";
import { toTailwind, fontSlug } from "./tailwind";
import { fontLink, docShell } from "./document";

const ORDER: Token[] = ["base", "sm", "md", "lg", "xl", "2xl"];
const MIN_WIDTH: Record<Token, number> = {
  base: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};
void STANDARD; // MIN_WIDTH mirrors STANDARD; kept explicit for the emitter's use.

export interface EmitOpts {
  title: string;
  tailwind: boolean;
  fonts: Map<string, Set<number>>;
  pageBg: string | null;
}

// A background value -> a Tailwind bg-[…] utility (a hex, or an image value with
// spaces underscored). Same rule the single-frame generator uses.
function bgUtil(bg: string): string {
  return bg.startsWith("#") ? `bg-[${bg}]` : `bg-[${bg.replace(/\s+/g, "_")}]`;
}

// The root's pinned width becomes fluid and its fixed height is dropped so the
// page grows with content instead of clamping to the base frame's size. `cap`,
// the widest frame in the set, is applied to the base rule only: it needs no
// per-breakpoint override, and it is what stops the largest layout from
// stretching edge to edge on a monitor wider than the design.
function fluidRoot(rule: Rule, cap: string | null): Rule {
  const out: Rule = { ...rule };
  if ("width" in out) out.width = "100%";
  if (cap) {
    out["max-width"] = cap;
    out.margin = "0 auto";
  }
  delete out.height;
  return out;
}

// The widest px width the root takes across the set, as a CSS length.
function widestRoot(root: MergedNode): string | null {
  let max = 0;
  for (const t of ORDER) {
    const w = root.rulesByToken[t]?.width;
    const px = typeof w === "string" && w.endsWith("px") ? parseFloat(w) : NaN;
    if (!Number.isNaN(px)) max = Math.max(max, px);
  }
  return max > 0 ? `${max}px` : null;
}

function serializeRule(rule: Rule): string {
  return Object.keys(rule)
    .map((k) => `  ${k}: ${rule[k]};`)
    .join("\n");
}

function cssBlock(cls: string, rule: Rule): string {
  const body = serializeRule(rule);
  return body ? `.${cls} {\n${body}\n}` : "";
}

// One flattened node ready to render: its own class, rules per token, presence,
// and inner content. Text variants and the tree's real nodes both become units.
interface Unit {
  tag: string;
  className: string;
  kind: "element" | "text" | "asset";
  rulesByToken: Partial<Record<Token, Rule>>;
  presentAt: Token[];
  text?: string;
  asset?: string;
  bleedBg?: string;
  href?: string;
}

// A text node whose content differs across breakpoints becomes one unit per
// distinct string, each shown only at its tokens. Identical strings stay one.
function textUnits(n: MergedNode): Unit[] {
  const groups = new Map<string, Token[]>();
  for (const t of n.presentAt) {
    const s = n.textByToken?.[t];
    if (s === undefined) continue;
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s)!.push(t);
  }
  const entries = [...groups.entries()];
  if (entries.length <= 1) {
    return [
      {
        tag: n.tag,
        className: n.className,
        kind: "text",
        rulesByToken: n.rulesByToken,
        presentAt: n.presentAt,
        text: entries[0]?.[0] ?? "",
        href: n.href,
      },
    ];
  }
  return entries.map(([str, toks], j) => ({
    tag: n.tag,
    className: `${n.className}-t${j}`,
    kind: "text" as const,
    rulesByToken: Object.fromEntries(toks.map((t) => [t, n.rulesByToken[t] ?? {}])) as Partial<
      Record<Token, Rule>
    >,
    presentAt: toks,
    text: str,
    href: n.href,
  }));
}

export function emitMerged(
  root: MergedNode,
  opts: EmitOpts,
): { combined: string; html: string; css: string } {
  // Tokens actually used anywhere in the tree, ascending, base first.
  const used = new Set<Token>(["base"]);
  const collect = (n: MergedNode) => {
    for (const t of ORDER) if (n.rulesByToken[t] || n.presentAt.includes(t)) used.add(t);
    n.children.forEach(collect);
  };
  collect(root);
  const tokens = ORDER.filter((t) => used.has(t));
  const rootCap = widestRoot(root);

  // CSS accumulators (unused in Tailwind mode).
  const baseCss: string[] = [];
  const tokenCss = new Map<Token, string[]>();

  // Returns the class attribute for a unit, registering CSS as a side effect in
  // CSS mode. In Tailwind mode it returns base utilities plus prefixed diffs.
  function classAttr(unit: Unit, isRoot: boolean): string {
    const baseRule = isRoot
      ? fluidRoot(unit.rulesByToken.base ?? {}, rootCap)
      : unit.rulesByToken.base ?? {};
    // Every root token carries the same cap, so the cascade sees no change and
    // emits it once on the base rule.
    const ruleAt = (t: Token): Rule => {
      const r = unit.rulesByToken[t];
      if (!r) return baseRule;
      return isRoot ? fluidRoot(r, rootCap) : r;
    };
    const firstPresent = tokens.find((t) => unit.presentAt.includes(t)) ?? "base";
    const shown = String(unit.rulesByToken[firstPresent]?.display ?? baseRule.display ?? "block");
    const displayMap = displayTransitions(unit.presentAt, tokens, shown);

    // Walk the breakpoints in order, carrying what is already in force, so a
    // property one token sets and the next drops is reset instead of leaking.
    const steps: { token: Token; diff: Rule }[] = [];
    let effective: Rule = { ...baseRule };
    for (const t of tokens) {
      if (t === "base") continue;
      const diff: Rule = unit.presentAt.includes(t) ? cascadeDiff(effective, ruleAt(t)) : {};
      if (unit.presentAt.includes(t)) effective = { ...ruleAt(t) };
      if (displayMap[t]) diff.display = displayMap[t];
      steps.push({ token: t, diff });
    }

    const base: Rule = { ...baseRule };
    if (displayMap.base) base.display = displayMap.base;

    if (!opts.tailwind) {
      const bb = cssBlock(unit.className, base);
      if (bb) baseCss.push(bb);
      if (unit.bleedBg) baseCss.push(bleedCss(unit.className, unit.bleedBg));
      for (const { token, diff } of steps) {
        const blk = cssBlock(unit.className, diff);
        if (blk) {
          if (!tokenCss.has(token)) tokenCss.set(token, []);
          tokenCss.get(token)!.push(blk);
        }
      }
      return unit.className;
    }

    let out = toTailwind(base);
    if (unit.bleedBg) out += (out ? " " : "") + bleedUtils(unit.bleedBg);
    for (const { token, diff } of steps) {
      const utils = toTailwind(diff);
      if (utils)
        out +=
          (out ? " " : "") +
          utils
            .split(/\s+/)
            .map((u) => `${token}:${u}`)
            .join(" ");
    }
    return out.trim();
  }

  function renderUnit(unit: Unit, isRoot: boolean, depth: number, childHtml: string): string {
    const indent = "  ".repeat(depth);
    const cls = classAttr(unit, isRoot);
    if (unit.kind === "asset" && unit.tag === "img") {
      return `${indent}<img class="${cls}" ${unit.asset} />`;
    }
    if (unit.kind === "text") {
      const attrs = unit.tag === "a" ? ` href="${unit.href ?? "#"}"` : "";
      // unit.text is already escaped/rendered HTML from the builder.
      return `${indent}<${unit.tag} class="${cls}"${attrs}>${unit.text ?? ""}</${unit.tag}>`;
    }
    if (unit.kind === "asset") {
      return `${indent}<${unit.tag} class="${cls}">${unit.asset ?? ""}</${unit.tag}>`;
    }
    if (!childHtml) return `${indent}<${unit.tag} class="${cls}"></${unit.tag}>`;
    return `${indent}<${unit.tag} class="${cls}">\n${childHtml}\n${indent}</${unit.tag}>`;
  }

  function walk(n: MergedNode, isRoot: boolean, depth: number): string {
    if (n.kind === "text") {
      return textUnits(n)
        .map((u) => renderUnit(u, isRoot, depth, ""))
        .join("\n");
    }
    const childHtml = n.children
      .map((c) => walk(c, false, depth + 1))
      .filter(Boolean)
      .join("\n");
    const unit: Unit = {
      tag: n.tag,
      className: n.className,
      kind: n.kind,
      rulesByToken: n.rulesByToken,
      presentAt: n.presentAt,
      asset: n.asset,
      bleedBg: n.bleedBg,
    };
    return renderUnit(unit, isRoot, depth, childHtml);
  }

  const body = walk(root, true, 3);
  const links = fontLink(opts.fonts);

  if (opts.tailwind) {
    const themeVars = Array.from(opts.fonts.keys())
      .map((fam) => `    --font-${fontSlug(fam)}: '${fam}', sans-serif;`)
      .join("\n");
    const theme = opts.fonts.size ? `  @theme {\n${themeVars}\n  }\n` : "";
    const twConfig = `${theme}  @layer base { * { line-height: normal; } }`;
    const bodyClass = `flex justify-center${opts.pageBg ? ` ${bgUtil(opts.pageBg)}` : ""}`;
    const head =
      `  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>\n` +
      `  <style type="text/tailwindcss">\n${twConfig}\n  </style>`;
    const doc = docShell(opts.title, links, head, body, bodyClass);
    return { combined: doc, html: doc, css: "" };
  }

  const mediaBlocks = tokens
    .filter((t) => t !== "base" && (tokenCss.get(t)?.length ?? 0) > 0)
    .map((t) => `@media (min-width: ${MIN_WIDTH[t]}px) {\n${tokenCss.get(t)!.join("\n\n")}\n}`);
  const rulesJoined = [...baseCss, ...mediaBlocks].join("\n\n");
  const bodyRule = `body { display: flex; justify-content: center;${opts.pageBg ? ` background: ${opts.pageBg};` : ""} }`;
  const stylesheet =
    "* { margin: 0; padding: 0; box-sizing: border-box; }\n" +
    "a { color: inherit; text-decoration: none; }\n" +
    "button { font: inherit; color: inherit; text-align: inherit; background: none; border: 0; cursor: pointer; -webkit-appearance: none; appearance: none; }\n" +
    bodyRule +
    "\n\n" +
    rulesJoined;
  const styleBlock = `  <style>\n${stylesheet.replace(/^/gm, "    ")}\n  </style>`;
  const linkBlock = `  <link rel="stylesheet" href="styles.css" />`;
  return {
    combined: docShell(opts.title, links, styleBlock, body),
    html: docShell(opts.title, links, linkBlock, body),
    css: stylesheet,
  };
}

// A full-viewport bleed painted behind the element, matching the single-frame
// generator. The element's own rule carries position/z-index (set upstream).
function bleedCss(cls: string, bg: string): string {
  return (
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
    `}`
  );
}

function bleedUtils(bg: string): string {
  return (
    "before:content-[''] before:absolute before:z-[-1] before:inset-y-0 " +
    `before:left-1/2 before:w-screen before:-ml-[50vw] before:${bgUtil(bg)}`
  );
}
