// The merged tree the responsive emitter consumes, plus the pure algorithms that
// build and serialise it. No Figma runtime here: nodes are only read for name,
// children, and identity so this stays headless-testable.

import type { Rule } from "./types";
import type { Token } from "./breakpoints";

// One node of the overlaid tree. Plain data: the emitter needs nothing else.
export interface MergedNode {
  tag: string; // resolved HTML tag, e.g. "div", "h1", "button"
  className: string; // stable, unique class for this node
  kind: "element" | "text" | "asset";
  // Style per breakpoint. `base` is always present; larger tokens hold that
  // frame's full rule (the emitter diffs against base).
  rulesByToken: Partial<Record<Token, Rule>>;
  presentAt: Token[]; // tokens whose frame contains this node
  children: MergedNode[];
  // kind "asset": the inline SVG string or the <img ...> element html.
  asset?: string;
  // kind "text": the string per token. One entry when all tokens agree.
  textByToken?: Partial<Record<Token, string>>;
  // A full-viewport-bleed background, when the node qualifies (carried through
  // from the single-frame bleed rule). Emitter turns this into a ::before.
  bleedBg?: string;
  // Link target when tag is "a".
  href?: string;
}

// Properties of `other` whose serialised value differs from `base` (added or
// changed). Values are already strings/numbers; compare by String().
export function diffRules(base: Rule, other: Rule): Rule {
  const out: Rule = {};
  for (const k of Object.keys(other)) {
    if (!(k in base) || String(base[k]) !== String(other[k])) out[k] = other[k];
  }
  return out;
}

// For each base child, its counterpart in otherKids. A uniquely-named base child
// is identified by that name: matched only to the same unique name, else null
// (a renamed or absent node is its own element, never position-guessed). An
// unnamed or duplicate-named child falls back to child index.
export function matchChildren(
  baseKids: SceneNode[],
  otherKids: SceneNode[],
): (SceneNode | null)[] {
  const count = (list: SceneNode[], name: string) =>
    list.filter((k) => (k.name || "") === name).length;
  return baseKids.map((child, i) => {
    const name = child.name || "";
    if (name && count(baseKids, name) === 1) {
      // Identity is the name: pair only with the same unique name, else nothing.
      return count(otherKids, name) === 1
        ? otherKids.find((k) => (k.name || "") === name) || null
        : null;
    }
    return otherKids[i] || null;
  });
}

// Children that exist in a larger frame but have no counterpart in the primary
// one, ready to be inserted into the merged child list.
//
// Two things matter here. Same-named siblings must stay distinct: Figma designs
// are full of repeated nodes all called "Card", and keying a group on the name
// alone collapses four service cards into one and silently drops three. So the
// key carries an occurrence counter within its own token. Across tokens the name
// still groups, so an element added by both the tablet and the desktop frame
// stays a single node present at both.
//
// `index` is where the node sat among its own frame's children, so the caller
// can splice it near its real position instead of pushing every addition to the
// end (which puts a section heading below the cards it introduces).
export function appendedGroups(
  perToken: { token: Token; kids: SceneNode[]; used: Set<SceneNode> }[],
): { index: number; nodes: { token: Token; node: SceneNode }[] }[] {
  const groups = new Map<string, { index: number; nodes: { token: Token; node: SceneNode }[] }>();
  let anon = 0;
  for (const { token, kids, used } of perToken) {
    const seen = new Map<string, number>();
    kids.forEach((k, i) => {
      if (used.has(k)) return;
      const name = k.name || "";
      const nth = seen.get(name) ?? 0;
      seen.set(name, nth + 1);
      const key = name ? `n:${name}#${nth}` : `a:${anon++}`;
      const g = groups.get(key);
      if (g) {
        g.nodes.push({ token, node: k });
        g.index = Math.min(g.index, i);
      } else {
        groups.set(key, { index: i, nodes: [{ token, node: k }] });
      }
    });
  }
  return [...groups.values()].sort((a, b) => a.index - b.index);
}

// The display value to SET at each token where this node's visibility flips,
// walking tokens in ascending order. A node present at a token shows with
// baseDisplay; absent shows "none". Only transitions are emitted (mobile-first
// cascade carries the rest). The first token (base) is emitted only when the
// node starts hidden.
export function displayTransitions(
  presentAt: Token[],
  order: Token[],
  baseDisplay: string,
): Partial<Record<Token, string>> {
  const present = new Set(presentAt);
  const out: Partial<Record<Token, string>> = {};
  let prevShown: boolean | null = null;
  for (const token of order) {
    const shown = present.has(token);
    if (prevShown === null) {
      // base: only note it when the node starts hidden.
      if (!shown) out[token] = "none";
    } else if (shown !== prevShown) {
      out[token] = shown ? baseDisplay : "none";
    }
    prevShown = shown;
  }
  return out;
}
