// Headless self-check for the pure merge algorithms. Run: bun run test/merge-model.ts
import { appendedGroups, cascadeDiff, matchChildren, displayTransitions } from "../src/merge-model";
import type { Token } from "../src/breakpoints";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
}

// cascadeDiff keeps only changed/added props.
const b0 = { "font-size": "32px", color: "#fff" };
const d = cascadeDiff(b0, { "font-size": "58px", color: "#fff" });
assert(
  JSON.stringify(d) === JSON.stringify({ "font-size": "58px" }),
  `only font-size changed: ${JSON.stringify(d)}`,
);
assert(Object.keys(cascadeDiff({ a: "1" }, { a: "1" })).length === 0, "identical rules diff to empty");
assert(cascadeDiff({}, { gap: "10px" }).gap === "10px", "a new prop is a diff");

// A property in force from a smaller breakpoint but absent here must be reset,
// or it leaks: a section pinned to the laptop width kept it on the desktop.
const leak = cascadeDiff({ "align-self": "stretch", width: "1360px" }, { "align-self": "stretch" });
assert(leak.width === "initial", `dropped width resets to initial: ${JSON.stringify(leak)}`);
assert(leak["align-self"] === undefined, "unchanged prop is not restated");

// A dropped property is RELEASED, not restored to base. The target rule is the
// complete rule for that breakpoint, so a property missing from it is one this
// frame does not want. Restoring base instead kept the mobile frame's pinned
// width and height on the desktop layout.
const back = cascadeDiff({ padding: "40px" }, { gap: "8px" });
assert(back.padding === "initial" && back.gap === "8px", `released, not restored: ${JSON.stringify(back)}`);
assert(
  cascadeDiff({ height: "566px" }, {}).height === "initial",
  "a height the larger frame hugs is released even when base pinned it",
);

// matchChildren: by name first. Fakes carry the fields the matcher reads.
const n = (name: string) => ({ name, type: "FRAME", children: [] }) as never as SceneNode;
// A branch (has children) and a leaf of the same name must never pair.
const branch = (name: string) => ({ name, type: "FRAME", children: [n("x")] }) as never as SceneNode;
const other = (name: string) => ({ name, type: "RECTANGLE" }) as never as SceneNode;
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

// Duplicate sibling names pair nth with nth.
const dupA = [n("Item"), n("Item")];
const dupB = [n("Item"), n("Item")];
const dup = matchChildren(dupA, dupB);
assert(dup[0] === dupB[0] && dup[1] === dupB[1], "duplicate names use position");

// Unequal counts: the extras go unmatched, the rest still line up.
const four = [n("Card"), n("Card"), n("Card"), n("Card")];
const three = [n("Card"), n("Card"), n("Card")];
const uneven = matchChildren(four, three);
assert(
  uneven[0] === three[0] && uneven[2] === three[2] && uneven[3] === null,
  "four cards against three leaves the fourth unmatched",
);

// A name the other frame never uses pairs with nothing, whatever sits at that
// index -- four mobile icon buttons must not bind to two desktop rows.
const icons = [n("Icon Container"), n("Icon Container")];
const rows = [n("Container"), n("Container")];
assert(
  matchChildren(icons, rows).every((m) => m === null),
  "an unused name never binds by position alone",
);

// The hero regression: the mobile image and the laptop text panel were both
// called "Sub Container". Same name, but a leaf never pairs with a branch, so
// each keeps its own element and the panel is not exported as an image.
const heroBase = [other("Sub Container")];
const heroLg = [branch("Sub Container"), other("Sub Container")];
const hero = matchChildren(heroBase, heroLg);
assert(hero[0] === heroLg[1], "the image pairs with the image, not the panel");

// Different Figma types never pair, whatever they are called.
assert(matchChildren([n("Box")], [other("Box")])[0] === null, "type mismatch does not pair");

// Two containers sharing a name but no copy are different things. The
// testimonials heading and the list of testimonial cards were both "Container",
// so the cards took the heading's slot and the heading was appended below them.
const withText = (name: string, ...lines: string[]) =>
  ({
    name,
    type: "FRAME",
    children: lines.map((c) => ({ name: "T", type: "TEXT", characters: c })),
  }) as never as SceneNode;
const heading = withText("Container", "What our Clients say About us");
const cardList = withText("Container", "SquareUp has been Instrumental in Transforming");
assert(
  matchChildren([cardList], [heading, cardList])[0] === cardList,
  "the cards pair with the cards, not the heading above them",
);
assert(
  matchChildren([heading], [heading, cardList])[0] === heading,
  "the heading pairs with the heading",
);

// One carries copy, the other carries none: a hamburger button and a
// "Contact Us" button, both called "Button".
const hamburger = { name: "Button", type: "FRAME", children: [n("Icon")] } as never as SceneNode;
const contact = withText("Button", "Contact Us");
assert(matchChildren([hamburger], [contact])[0] === null, "a text-less button does not pair with a labelled one");

// Content only separates containers. A text node whose copy changes between
// frames stays one node with two strings, which the emitter toggles.
const ctaShort = { name: "CTA", type: "TEXT", characters: "Sign up" } as never as SceneNode;
const ctaLong = { name: "CTA", type: "TEXT", characters: "Sign up for free" } as never as SceneNode;
assert(
  matchChildren([ctaShort], [ctaLong])[0] === ctaLong,
  "a text leaf still pairs across a copy change",
);

// appendedGroups applies the same guard when two frames order additions apart.
const gA = branch("Sub Container"), gB = other("Sub Container");
const guarded = appendedGroups([
  { token: "lg", kids: [gA, gB], used: new Set() },
  { token: "xl", kids: [gB, gA], used: new Set() },
]);
assert(guarded.length === 2, `reordered additions stay two groups, got ${guarded.length}`);
assert(
  guarded.every((g) => g.nodes.every((x) => x.node.type === g.nodes[0].node.type)),
  "no group mixes a leaf with a branch",
);

// Position still resolves within a name, not across the whole list.
const mixed = matchChildren([n("Heading"), n("Card"), n("Card")], [n("Card"), n("Card")]);
assert(mixed[0] === null, "the heading has no counterpart");
assert(mixed[1] !== null && mixed[2] !== null, "both cards still pair");

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
