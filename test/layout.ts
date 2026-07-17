// Headless self-check for positionAndSize (no framework). Run: bun run test/layout.ts
// positionAndSize makes no figma.* runtime calls, so it runs outside Figma.
import { positionAndSize } from "../src/layout";
import { ignoresAutoLayout } from "../src/nodes";
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

console.log("layout: all checks passed");
