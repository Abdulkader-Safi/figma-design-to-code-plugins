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

// What a breakpoint must declare to reach `target`, given `effective`: what the
// smaller breakpoints already put in force.
//
// The second loop is the part that is easy to miss. A mobile-first cascade only
// ever adds, so a property one breakpoint sets and the next one does not stays
// in force: a section pinned to 1360px for the laptop frame kept that width in
// the desktop layout, where it should stretch.
export function cascadeDiff(effective: Rule, target: Rule): Rule {
  const out: Rule = {};
  for (const k of Object.keys(target)) {
    if (!(k in effective) || String(effective[k]) !== String(target[k])) out[k] = target[k];
  }
  for (const k of Object.keys(effective)) {
    if (k in target) continue;
    // Released, not restored to the base value. `target` is the complete rule
    // for this breakpoint, so a property missing from it is a property this
    // frame does not want. Falling back to base kept the mobile frame's pinned
    // height and width on the desktop layout, where both should be automatic:
    // the navbar stayed 390px wide at 1920 and every section kept its phone
    // height.
    out[k] = "initial";
  }
  return out;
}

// Whether two nodes can stand for the same element at all. Sharing a name is not
// enough on its own: a mobile frame's hero image and a laptop frame's text panel
// were both called "Sub Container", and pairing them exported the panel as a
// stretched image. Same Figma type, and a leaf only ever pairs with a leaf.
export function compatible(a: SceneNode, b: SceneNode): boolean {
  if (a.type !== b.type) return false;
  const kids = (n: SceneNode) => ("children" in n ? n.children.length : 0);
  return (kids(a) === 0) === (kids(b) === 0);
}

// For each base child, its counterpart in otherKids. Identity is the name, with
// position breaking ties inside a name: the nth "Card" takes the next unclaimed
// compatible "Card". A name the other frame does not use pairs with nothing, so
// a node the designer rebuilt rather than restyled stays its own element instead
// of inheriting a stranger's position.
//
// Matching on the raw index instead bound a mobile icon button to whatever
// desktop node shared its slot and then forced their unrelated subtrees
// together. Bucketing also means four cards against three leave the fourth
// unmatched rather than shifting every pair by one.
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
  // ponytail: linear scan per child. Sibling counts are small; if a frame ever
  // holds thousands of same-named children this wants an index per bucket.
  const claimed = new Set<SceneNode>();
  return baseKids.map((child) => {
    const bucket = byName.get(child.name || "");
    const hit = bucket?.find((k) => !claimed.has(k) && compatible(child, k));
    if (hit) claimed.add(hit);
    return hit ?? null;
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
  type Group = { index: number; nodes: { token: Token; node: SceneNode }[] };
  const byName = new Map<string, Group[]>();
  const all: Group[] = [];
  for (const { token, kids, used } of perToken) {
    kids.forEach((k, i) => {
      if (used.has(k)) return;
      const name = k.name || "";
      const list = byName.get(name);
      // Join the first group of this name that is compatible and does not yet
      // hold this token. Skipping groups that already hold it is what keeps four
      // sibling "Card"s four groups; the compatibility check is what stops an
      // image joining a text panel when two frames order their additions apart.
      let group = name
        ? list?.find(
            (g) => !g.nodes.some((x) => x.token === token) && compatible(g.nodes[0].node, k),
          )
        : undefined;
      if (!group) {
        group = { index: i, nodes: [] };
        all.push(group);
        if (list) list.push(group);
        else byName.set(name, [group]);
      }
      group.nodes.push({ token, node: k });
      group.index = Math.min(group.index, i);
    });
  }
  return all.sort((a, b) => a.index - b.index);
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
