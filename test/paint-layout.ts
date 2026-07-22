// Self-check for stacked fills, negative gap, wrap and grid auto layout.
// Run: bun run test/paint-layout.ts
//
// Every shape here is lifted from a real dumped fixture, so these are the exact
// cases that were exporting wrong, not invented ones.
import { hydrateFrames } from "./replay";

const { generate } = await import("../src/generate");

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
}

type Fake = Record<string, unknown>;

const BOX: Fake = {
  type: "FRAME",
  visible: true,
  x: 0,
  y: 0,
  width: 200,
  height: 100,
  rotation: 0,
  opacity: 1,
  layoutMode: "NONE",
  layoutPositioning: "AUTO",
  layoutSizingHorizontal: "FIXED",
  layoutSizingVertical: "FIXED",
  primaryAxisAlignItems: "MIN",
  counterAxisAlignItems: "MIN",
  itemSpacing: 0,
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  fills: [],
  strokes: [],
  effects: [],
  cornerRadius: 0,
  clipsContent: false,
  children: [],
};

const text = (name: string, characters: string): Fake => {
  const t: Fake = {
    ...BOX,
    name,
    type: "TEXT",
    characters,
    textAutoResize: "NONE",
    textAlignHorizontal: "LEFT",
    fontName: { family: "Inter", style: "Regular" },
    fontSize: 16,
    textCase: "ORIGINAL",
    textDecoration: "NONE",
    letterSpacing: { unit: "PIXELS", value: 0 },
    lineHeight: { unit: "AUTO" },
    hyperlink: null,
  };
  delete t.children;
  return t;
};

const solid = (r: number, g: number, b: number, o = 1, blend?: string) => ({
  type: "SOLID",
  visible: true,
  color: { r, g, b },
  opacity: o,
  ...(blend ? { blendMode: blend } : {}),
});
const image = (o = 1, blend?: string) => ({
  type: "IMAGE",
  visible: true,
  scaleMode: "FILL",
  imageHash: "abc",
  opacity: o,
  ...(blend ? { blendMode: blend } : {}),
});

const html = async (frame: Fake) => {
  const [live] = hydrateFrames([frame as never]);
  const out = await generate(live, { semantic: false, tailwind: false });
  return out.combined;
};

// --- 1. A container with an image fill keeps its children -------------------
// This is the bug that deleted the hero: hasImageFill made any node with an
// image fill an <img>, so everything inside it vanished.
const overlaySection = {
  ...BOX,
  name: "Text Container",
  width: 1440,
  height: 300,
  layoutMode: "VERTICAL",
  fills: [image(1, "OVERLAY"), image(0.6), solid(0.1, 0.1, 0.1, 0.2, "COLOR")],
  children: [text("Heading", "Our Services")],
};
const overlay = await html({ ...BOX, name: "Page", width: 1440, layoutMode: "VERTICAL", children: [overlaySection] });
assert(overlay.includes("Our Services"), "the heading inside an image-filled container survives");
assert(!/<img class="text-container/.test(overlay), "the container is not replaced by an img");

// Three paints become three overlay elements, in Figma's bottom-to-top order.
const fillClasses = [...overlay.matchAll(/class="(text-container-\d+-fill\d)"/g)].map((m) => m[1]);
assert(fillClasses.length === 3, `one overlay per paint, got ${fillClasses.length}`);
assert(
  fillClasses.every((c, i) => c.endsWith(`-fill${i}`)),
  `overlays keep paint order: ${fillClasses}`,
);
assert(overlay.includes("mix-blend-mode: overlay"), "the OVERLAY paint keeps its blend mode");
assert(overlay.includes("mix-blend-mode: color"), "the COLOR paint keeps its blend mode");
assert(overlay.includes("opacity: 0.6"), "the 60% image keeps its own opacity");
assert(overlay.includes("isolation: isolate"), "blending is contained to the node");

// A leaf with an image fill is still an <img>: that case was never broken.
const avatar = { ...BOX, name: "Profile", width: 48, height: 48, fills: [image()] };
delete (avatar as Fake).children;
const leaf = await html({ ...BOX, name: "Page", layoutMode: "VERTICAL", children: [avatar] });
assert(/<img class="profile-\d+"/.test(leaf), "a leaf image is still an img");

// A single plain fill stays a plain background, not a layer stack.
const plain = await html({
  ...BOX,
  name: "Page",
  layoutMode: "VERTICAL",
  fills: [solid(1, 0, 0)],
  children: [text("T", "hi")],
});
assert(plain.includes("background: #ff0000"), "one plain paint is one background");
assert(!plain.includes("-fill0"), "one plain paint needs no overlay element");

// --- 2. Negative gap --------------------------------------------------------
// CSS gap cannot be negative, so the overlap moves to sibling margins. Figma's
// "first on top" canvas stacking becomes a descending z-index.
const heroKid = (n: string) => ({ ...BOX, name: n, width: 1440, height: 400, children: [text(n + "T", n)] });
const hero = await html({
  ...BOX,
  name: "Hero Section",
  width: 1440,
  layoutMode: "VERTICAL",
  itemSpacing: -174,
  itemReverseZIndex: true,
  children: [heroKid("Top"), heroKid("Bottom")],
});
assert(hero.includes("margin-top: -174px"), "the negative gap becomes a sibling margin");
assert(!/gap: -/.test(hero), "no negative gap declaration is emitted");
const zIdx = [...hero.matchAll(/z-index: (\d+)/g)].map((m) => Number(m[1]));
assert(zIdx[0] > zIdx[1], `first on top means a descending z-index, got ${zIdx}`);

// A horizontal parent overlaps sideways instead.
const row = await html({
  ...BOX,
  name: "Row",
  layoutMode: "HORIZONTAL",
  itemSpacing: -20,
  children: [heroKid("A"), heroKid("B")],
});
assert(row.includes("margin-left: -20px"), "a horizontal parent overlaps on the inline axis");

// --- 3. Wrap ----------------------------------------------------------------
// counterAxisSpacing is the gap BETWEEN lines and is a separate property; using
// the gap shorthand for both is wrong whenever they differ. align-content must
// be set too, or every line silently stretches.
const wrapped = await html({
  ...BOX,
  name: "Images Container",
  width: 600,
  layoutMode: "HORIZONTAL",
  layoutWrap: "WRAP",
  itemSpacing: 12,
  counterAxisSpacing: 30,
  counterAxisAlignItems: "CENTER",
  children: [heroKid("A"), heroKid("B"), heroKid("C")],
});
assert(wrapped.includes("flex-wrap: wrap"), "wrapping is emitted");
assert(wrapped.includes("column-gap: 12px"), "itemSpacing is the inline gap");
assert(wrapped.includes("row-gap: 30px"), "counterAxisSpacing is the line gap");
assert(wrapped.includes("align-content: center"), "lines align, not just items");
assert(!/[^-]gap: 12px/.test(wrapped), "the gap shorthand is not used when the two differ");

// --- 4. Grid auto layout ----------------------------------------------------
// layoutMode GRID is in the current API and was falling through to nothing, so
// a grid frame exported with no display at all.
const cell = (n: string, col: number, row: number, cs = 1, rs = 1) => ({
  ...BOX,
  name: n,
  gridColumnAnchorIndex: col,
  gridRowAnchorIndex: row,
  gridColumnSpan: cs,
  gridRowSpan: rs,
  gridChildHorizontalAlign: "CENTER",
  layoutSizingHorizontal: "FILL",
  children: [text(n + "T", n)],
});
const grid = await html({
  ...BOX,
  name: "Grid",
  width: 1200,
  layoutMode: "GRID",
  gridColumnSizes: [{ type: "FLEX", value: 1 }, { type: "FIXED", value: 300 }, { type: "HUG" }],
  gridRowSizes: [{ type: "FLEX", value: 1 }],
  gridColumnGap: 24,
  gridRowGap: 16,
  children: [cell("A", 0, 0), cell("B", 1, 0, 2)],
});
assert(grid.includes("display: grid"), "a GRID frame is a CSS grid");
assert(
  grid.includes("grid-template-columns: 1fr 300px fit-content(100%)"),
  "each track type maps: FLEX to fr, FIXED to px, HUG to fit-content",
);
assert(grid.includes("column-gap: 24px") && grid.includes("row-gap: 16px"), "grid gaps are separate");
assert(grid.includes("grid-column: 1 / span 1"), "0-based anchors become 1-based grid lines");
assert(grid.includes("grid-column: 2 / span 2"), "a span is carried through");
assert(grid.includes("justify-self: center"), "child alignment is carried through");
// Scoped to the grid node's own rule: the document body is a flex container.
const gridBlock = grid.slice(grid.indexOf(".grid-"), grid.indexOf("}", grid.indexOf(".grid-")));
assert(!gridBlock.includes("display: flex"), `the grid frame is not also flex:\n${gridBlock}`);
assert(!gridBlock.includes("flex-direction"), "no flex-direction on a grid frame");

console.log("paint-layout: all checks passed");
