// Headless self-check for the pure merge algorithms. Run: bun run test/merge-model.ts
import { appendedGroups, diffRules, matchChildren, displayTransitions } from "../src/merge-model";
import type { Token } from "../src/breakpoints";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
}

// diffRules keeps only changed/added props.
const d = diffRules({ "font-size": "32px", color: "#fff" }, { "font-size": "58px", color: "#fff" });
assert(
  JSON.stringify(d) === JSON.stringify({ "font-size": "58px" }),
  `only font-size changed: ${JSON.stringify(d)}`,
);
assert(Object.keys(diffRules({ a: "1" }, { a: "1" })).length === 0, "identical rules diff to empty");
assert(diffRules({}, { gap: "10px" }).gap === "10px", "a new prop is a diff");

// matchChildren: by name first.
const n = (name: string) => ({ name, children: [] }) as never as SceneNode;
const byName = matchChildren([n("Logo"), n("Title")], [n("Title"), n("Logo")]);
assert(
  (byName[0] as SceneNode).name === "Logo" && (byName[1] as SceneNode).name === "Title",
  "matched across reorder by name",
);

// matchChildren: unnamed falls back to index.
const u = () => ({ name: "", children: [] }) as never as SceneNode;
const a1 = u(), a2 = u(), b1 = u(), b2 = u();
const byIndex = matchChildren([a1, a2], [b1, b2]);
assert(byIndex[0] === b1 && byIndex[1] === b2, "unnamed matched by position");

// matchChildren: a base child with no counterpart is null.
const none = matchChildren([n("Extra")], [n("Other")]);
assert(none[0] === null, "no counterpart is null");

// Duplicate sibling names fall back to index (not a unique name match).
const dupA = [n("Item"), n("Item")];
const dupB = [n("Item"), n("Item")];
const dup = matchChildren(dupA, dupB);
assert(dup[0] === dupB[0] && dup[1] === dupB[1], "duplicate names use position");

// appendedGroups: four unmatched siblings all named "Card" stay four groups.
// Collapsing them on the name alone dropped three of every four service cards.
const cards = [n("Card"), n("Card"), n("Card"), n("Card")];
const g1 = appendedGroups([{ token: "lg", kids: cards, used: new Set() }]);
assert(g1.length === 4, `four same-named siblings stay distinct, got ${g1.length}`);
assert(
  g1.map((g) => g.index).join(",") === "0,1,2,3",
  `each keeps its own index: ${g1.map((g) => g.index)}`,
);

// The same logical addition in two larger frames is still one node at both.
const lgKids = [n("Sidebar")], xlKids = [n("Sidebar")];
const g2 = appendedGroups([
  { token: "lg", kids: lgKids, used: new Set() },
  { token: "xl", kids: xlKids, used: new Set() },
]);
assert(g2.length === 1, `same name across tokens groups into one, got ${g2.length}`);
assert(
  g2[0].nodes.map((x) => x.token).join(",") === "lg,xl",
  `present at both tokens: ${g2[0].nodes.map((x) => x.token)}`,
);

// Matched children are skipped, and the nth same-named node pairs with the nth.
const lgRows = [n("Row"), n("Row")], xlRows = [n("Row"), n("Row")];
const g3 = appendedGroups([
  { token: "lg", kids: lgRows, used: new Set([lgRows[0]]) },
  { token: "xl", kids: xlRows, used: new Set() },
]);
assert(g3.length === 2, `one matched row leaves two groups, got ${g3.length}`);

// Unnamed nodes never group across tokens, and groups come back in order.
const g4 = appendedGroups([
  { token: "lg", kids: [n("Heading"), u(), u()], used: new Set() },
]);
assert(g4.length === 3 && g4[0].index === 0, "unnamed siblings stay separate, sorted by index");

// displayTransitions: present only from md up -> hidden at base, shown at md.
const order: Token[] = ["base", "sm", "md", "lg", "xl", "2xl"];
const t1 = displayTransitions(["md", "lg", "xl"], order, "flex");
assert(t1.base === "none" && t1.md === "flex" && t1.lg === undefined, `appear at md: ${JSON.stringify(t1)}`);

// present at base, dropped at xl.
const t2 = displayTransitions(["base", "sm", "md", "lg"], order, "block");
assert(t2.base === undefined && t2.xl === "none", `drop at xl: ${JSON.stringify(t2)}`);

// present everywhere -> no transitions.
assert(
  Object.keys(displayTransitions(order, order, "flex")).length === 0,
  "present everywhere has no transitions",
);

console.log("merge-model: all checks passed");
