// Overlay the selected frames onto the smallest (base) frame's structure into a
// MergedNode tree. Figma-dependent: it styles each node per frame via nodeRule
// and exports assets. The matching it relies on (matchChildren) is unit-tested
// in test/merge-model.ts.
//
// Reparenting and per-breakpoint text need no special handling here. A node that
// moves to a different parent in a larger frame simply finds no counterpart under
// its base parent (so that copy hides at that token) and reappears as an appended
// child under its new parent (shown only there): duplicate-and-toggle for free.
// Text whose characters differ across frames is stored per token; the emitter
// splits it into toggled variants.

import type { Rule } from "./types";
import type { Token } from "./breakpoints";
import type { FrameVariant } from "./responsive";
import { type MergedNode, appendedGroups, matchChildren } from "./merge-model";
import { nodeRule, type NodeStyle } from "./generate";
import type { ImageStore } from "./paint";
import { headingMap } from "./semantic";

const ORDER: Token[] = ["base", "sm", "md", "lg", "xl", "2xl"];

interface Entry {
  node: SceneNode;
  parent: SceneNode | null;
}

const visibleChildren = (n: SceneNode): SceneNode[] =>
  "children" in n
    ? n.children.filter((c) => !("visible" in c) || c.visible !== false)
    : [];

export async function buildMergedTree(
  variants: FrameVariant[],
  opts: { semantic: boolean; images?: ImageStore },
  addFont: (family: string, weight: number) => void,
): Promise<MergedNode> {
  const headingsByToken = new Map<Token, Map<number, string>>();
  const pageWByToken = new Map<Token, number>();
  for (const v of variants) {
    headingsByToken.set(v.token, opts.semantic ? headingMap(v.frame) : new Map());
    pageWByToken.set(v.token, "width" in v.frame ? Math.round(v.frame.width) : 0);
  }

  let counter = 0;
  const className = (node: SceneNode): string => {
    const base =
      (node.name || node.type)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 28) || "node";
    return `${base}-${counter++}`;
  };

  // Build one logical node from its per-token frame instances.
  async function buildNode(
    entries: Map<Token, Entry>,
    isRoot: boolean,
    topBand: boolean,
    parentTag: string,
    interactive: boolean,
  ): Promise<MergedNode | null> {
    const inList = parentTag === "ul" || parentTag === "ol";

    // Presence is just visibility (what nodeRule would return non-null for), so
    // the primary token is known before styling. Only the primary frame's asset
    // is kept, so only it is exported; the rest skip the costly exportAsync.
    const visible = (n: SceneNode) => !("visible" in n) || n.visible !== false;
    const candidateTokens = ORDER.filter((t) => {
      const e = entries.get(t);
      return e ? visible(e.node) : false;
    });
    if (candidateTokens.length === 0) return null;
    const primaryToken = candidateTokens[0];

    const styleByToken = new Map<Token, NodeStyle>();
    for (const t of candidateTokens) {
      const e = entries.get(t)!;
      const style = await nodeRule(
        e.node,
        e.parent,
        {
          headings: headingsByToken.get(t) ?? new Map(),
          semantic: opts.semantic,
          images: opts.images,
          addFont,
          pageW: pageWByToken.get(t) ?? 0,
          topBand,
          inList,
          interactive,
        },
        t === primaryToken,
      );
      if (style) styleByToken.set(t, style);
    }

    const presentTokens = ORDER.filter((t) => styleByToken.has(t));
    if (presentTokens.length === 0) return null;
    const primary = styleByToken.get(primaryToken)!;
    const primaryNode = entries.get(primaryToken)!.node;

    const rulesByToken: Partial<Record<Token, Rule>> = {};
    const textByToken: Partial<Record<Token, string>> = {};
    for (const t of presentTokens) {
      const s = styleByToken.get(t)!;
      rulesByToken[t] = s.rule;
      if (s.kind === "text" && s.text !== undefined) textByToken[t] = s.text;
    }

    const merged: MergedNode = {
      tag: primary.tag,
      className: className(primaryNode),
      kind: primary.kind,
      rulesByToken,
      presentAt: presentTokens,
      children: [],
    };
    if (primary.kind === "text") merged.textByToken = textByToken;
    if (primary.kind === "asset") merged.asset = primary.asset;
    if (primary.href) merged.href = primary.href;
    if (primary.bleedBg) merged.bleedBg = primary.bleedBg;

    // Only element nodes carry children.
    if (primary.kind !== "element") return merged;

    const tag = primary.tag;
    const childInteractive = interactive || tag === "a" || tag === "button";
    const childTopBand = isRoot; // this node's children sit at the top band iff it is the root

    const primaryKids = visibleChildren(primaryNode);
    // Per larger present token, match its children to the primary's children.
    const matches = new Map<Token, (SceneNode | null)[]>();
    const usedByToken = new Map<Token, Set<SceneNode>>();
    for (const t of presentTokens) {
      if (t === primaryToken) continue;
      const tKids = visibleChildren(entries.get(t)!.node);
      const matched = matchChildren(primaryKids, tKids);
      matches.set(t, matched);
      usedByToken.set(t, new Set(matched.filter((m): m is SceneNode => m !== null)));
    }

    const children: MergedNode[] = [];
    for (let i = 0; i < primaryKids.length; i++) {
      const childEntries = new Map<Token, Entry>();
      childEntries.set(primaryToken, { node: primaryKids[i], parent: primaryNode });
      for (const [t, arr] of matches) {
        const m = arr[i];
        if (m) childEntries.set(t, { node: m, parent: entries.get(t)!.node });
      }
      const c = await buildNode(childEntries, false, childTopBand, tag, childInteractive);
      if (c) children.push(c);
    }

    // Children that exist in a larger frame but not the primary, spliced in at
    // the position they hold in their own frame.
    const groups = appendedGroups(
      presentTokens
        .filter((t) => t !== primaryToken)
        .map((t) => ({
          token: t,
          kids: visibleChildren(entries.get(t)!.node),
          used: usedByToken.get(t)!,
        })),
    );
    for (const group of groups) {
      const childEntries = new Map<Token, Entry>();
      for (const { token, node } of group.nodes) {
        childEntries.set(token, { node, parent: entries.get(token)!.node });
      }
      const c = await buildNode(childEntries, false, childTopBand, tag, childInteractive);
      if (c) children.splice(Math.min(group.index, children.length), 0, c);
    }

    merged.children = children;
    return merged;
  }

  const rootEntries = new Map<Token, Entry>();
  for (const v of variants) rootEntries.set(v.token, { node: v.frame, parent: null });
  const tree = await buildNode(rootEntries, true, false, "", false);
  return (
    tree ?? {
      tag: "div",
      className: "root-0",
      kind: "element",
      rulesByToken: { base: {} },
      presentAt: ["base"],
      children: [],
    }
  );
}
