// Headless self-check for positionAndSize (no framework). Run: bun run test/layout.ts
// positionAndSize makes no figma.* runtime calls, so it runs outside Figma.
import { positionAndSize } from "../src/layout";
import { ignoresAutoLayout, isArcEllipse, isVectorLike, hugsText } from "../src/nodes";
import type { Rule } from "../src/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
}

// Minimal fake nodes; only the fields the layout code reads matter.
const frame = (over: object = {}) =>
  ({
    layoutMode: "HORIZONTAL",
    absoluteBoundingBox: { x: 0, y: 0, width: 1596, height: 577 },
    ...over,
  }) as never as SceneNode;

// A divider: a 577px line turned 90 degrees, so Figma reports 577x0 while it
// renders as 1x577. The real export produced w-[577px] here and crushed the row.
const rotatedLine = {
  width: 577,
  height: 0,
  x: 500,
  y: 0,
  rotation: 90,
  layoutSizingHorizontal: "FIXED",
  layoutSizingVertical: "FILL",
  absoluteBoundingBox: { x: 500, y: 0, width: 1, height: 577 },
} as never as SceneNode;

let r: Rule = {};
positionAndSize(rotatedLine, frame(), false, true, r);
assert(r.width === "1px", `rotated line in flow is 1px wide, got ${r.width}`);
assert(r["align-self"] === "stretch", `vertical FILL stretches: ${r["align-self"]}`);

// Same line, absolutely placed: the box comes from the rendered bounds too, and
// stays relative to the parent rather than the canvas.
r = {};
positionAndSize(rotatedLine, frame({ layoutMode: "NONE" }), true, true, r);
assert(r.width === "1px" && r.height === "577px", `rotated line box: ${r.width}x${r.height}`);
assert(r.left === "500px" && r.top === "0px", `parent-relative: ${r.left},${r.top}`);
assert(r.transform === undefined, "a baked asset already holds its rotation");

// A rotated node rebuilt from CSS keeps its own box and gets the rotation back.
const rotatedText = {
  width: 100,
  height: 20,
  x: 10,
  y: 30,
  rotation: 90,
  relativeTransform: [
    [0, 1, 10],
    [-1, 0, 30],
  ],
  absoluteBoundingBox: { x: 10, y: 30, width: 20, height: 100 },
} as never as SceneNode;

r = {};
positionAndSize(rotatedText, frame({ layoutMode: "NONE" }), true, false, r);
assert(r.width === "100px" && r.height === "20px", `own box kept: ${r.width}x${r.height}`);
assert(r.transform === "matrix(0, -1, 1, 0, 0, 0)", `matrix from Figma: ${r.transform}`);
assert(r["transform-origin"] === "0 0", "top-left origin matches Figma's transform");

// Unrotated nodes must be untouched by any of the above.
const plain = {
  width: 200,
  height: 60,
  x: 12,
  y: 8,
  rotation: 0,
  absoluteBoundingBox: { x: 12, y: 8, width: 200, height: 60 },
} as never as SceneNode;

r = {};
positionAndSize(plain, frame({ layoutMode: "NONE" }), true, true, r);
assert(r.left === "12px" && r.top === "8px", `plain position: ${r.left},${r.top}`);
assert(r.width === "200px" && r.height === "60px", `plain size: ${r.width}x${r.height}`);
assert(r.transform === undefined, "no transform on an unrotated node");

// A filling image must be free to shrink to its share. Its intrinsic width is
// the exported PNG's (2x the design), and min-width:auto would pin it there and
// shove its siblings out of the row.
const fillingImage = {
  width: 440,
  height: 348,
  x: 0,
  y: 0,
  rotation: 0,
  layoutSizingHorizontal: "FILL",
  layoutSizingVertical: "FILL",
} as never as SceneNode;

r = {};
positionAndSize(fillingImage, frame(), false, true, r);
assert(r.flex === "1 1 0", `fills the row: ${r.flex}`);
assert(r["min-width"] === "0", `main-axis min floor cleared: ${r["min-width"]}`);
assert(r["align-self"] === "stretch", `cross axis stretches: ${r["align-self"]}`);
assert(r["min-height"] === undefined, "the cross axis has no automatic minimum");
assert(r.width === undefined && r.height === undefined, "a FILL child sets no fixed size");

// Same node in a column: the floor moves to the axis it flexes along.
r = {};
positionAndSize(fillingImage, frame({ layoutMode: "VERTICAL" }), false, true, r);
assert(r.flex === "1 1 0" && r["min-height"] === "0", `column main axis: ${JSON.stringify(r)}`);
assert(r["min-width"] === undefined, "no floor cleared on the cross axis");

// A FIXED child keeps its size and must not gain a min-* override.
r = {};
positionAndSize(
  { ...(plain as object), layoutSizingHorizontal: "FIXED", layoutSizingVertical: "FIXED" } as never as SceneNode,
  frame(),
  false,
  false,
  r,
);
assert(r.width === "200px" && r.height === "60px", `FIXED keeps its box: ${r.width}x${r.height}`);
assert(r["min-width"] === undefined && r["min-height"] === undefined, "no min-* on a FIXED child");
assert(r["flex-shrink"] === 0, "a FIXED child in an auto-layout row does not shrink");

// The "Ignore auto layout" toggle is what pulls a child out of the flow.
assert(
  ignoresAutoLayout({ layoutPositioning: "ABSOLUTE" } as never as SceneNode),
  "ABSOLUTE layoutPositioning ignores auto layout",
);
assert(
  !ignoresAutoLayout({ layoutPositioning: "AUTO" } as never as SceneNode),
  "AUTO layoutPositioning stays in the flow",
);
assert(!ignoresAutoLayout({} as never as SceneNode), "no property means in the flow");

// An ellipse is only a CSS box when it's a full, solid ellipse. Arc handles turn
// it into a ring or a pie, which a border-radius: 50% div paints as a disc.
const ellipse = (arc: object) =>
  ({
    type: "ELLIPSE",
    arcData: { startingAngle: 0, endingAngle: Math.PI * 2, innerRadius: 0, ...arc },
  }) as never as SceneNode;

assert(!isArcEllipse(ellipse({})), "a plain full ellipse stays a rounded div");
assert(isArcEllipse(ellipse({ innerRadius: 0.9 })), "a ring is an arc ellipse");
assert(isArcEllipse(ellipse({ endingAngle: Math.PI })), "a half sweep is an arc ellipse");
assert(isVectorLike(ellipse({ innerRadius: 0.9 })), "a ring exports as SVG");
assert(!isVectorLike(ellipse({})), "a plain ellipse does not export as SVG");
// Floating point drift on a full turn must not tip a plain ellipse into SVG.
assert(
  !isArcEllipse(ellipse({ endingAngle: Math.PI * 2 - 1e-12 })),
  "a full turn tolerates float drift",
);

// Only Figma's "Auto width" text is exact-fit; the other modes wrap on purpose.
const text = (mode: string) =>
  ({ type: "TEXT", textAutoResize: mode }) as never as SceneNode;
assert(hugsText(text("WIDTH_AND_HEIGHT")), "auto width hugs its glyphs");
assert(!hugsText(text("HEIGHT")), "auto height wraps on purpose");
assert(!hugsText(text("NONE")), "a fixed text box wraps on purpose");
assert(!hugsText(text("TRUNCATE")), "a truncating text box is not a hug");
assert(!hugsText({ type: "FRAME" } as never as SceneNode), "only TEXT hugs");

console.log("layout: all checks passed");
