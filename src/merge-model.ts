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

// What a breakpoint must declare to reach `target`, given `effective` (what the
// smaller breakpoints already put in force) and `base` (the unprefixed rule).
//
// The second loop is the part that is easy to miss. A mobile-first cascade only
// ever adds, so a property one breakpoint sets and the next one does not stays
// in force: a section pinned to width 1360px for the laptop frame kept that
// width in the desktop layout, where it should stretch. Anything dropped is put
// back to its base value, or to `initial` when base never set it.
export function cascadeDiff(effective: Rule, target: Rule, base: Rule): Rule {
  const out: Rule = {};
  for (const k of Object.keys(target)) {
    if (!(k in effective) || String(effective[k]) !== String(target[k])) out[k] = target[k];
  }
  for (const k of Object.keys(effective)) {
    if (k in target) continue;
    const want = k in base ? base[k] : "initial";
    if (String(effective[k]) !== String(want)) out[k] = want;
  }
  return out;
}

// For each base child, its counterpart in otherKids. Identity is the name, and
// position only breaks ties within a name: the nth child called "Card" pairs
// with the nth child called "Card". A name the other frame does not use at all
// pairs with nothing, so a node the designer replaced rather than restyled stays
// its own element instead of inheriting a stranger's position.
//
// Bucketing by name matters when the two frames hold different counts. Raw index
// matching paired a mobile icon button with a desktop row that happened to sit
// at the same position, then forced their unrelated children together; pairing
// four cards with three now leaves the fourth unmatched and lines the rest up.
export function matchChildren(
  baseKids: SceneNode[],
  otherKids: SceneNode[],
): (SceneNode | null)[] {
  const byName = new Map<string, SceneNode[]>();
  for (const k of otherKids) {
    const name = k.name || "";
    const bucket = byName.get(name);
    if (bucket) bucket.push(k);
    else byName.set(name, [k]);
  }
  const taken = new Map<string, number>();
  return baseKids.map((child) => {
    const name = child.name || "";
    const nth = taken.get(name) ?? 0;
    taken.set(name, nth + 1);
    return byName.get(name)?.[nth] ?? null;
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
