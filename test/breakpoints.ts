// Headless self-check for assignBreakpoints. Run: bun run test/breakpoints.ts
import { assignBreakpoints } from "../src/breakpoints";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
}

// Smallest is base; each larger frame snaps to the largest standard token
// at or below its width, strictly increasing.
const three = assignBreakpoints([390, 810, 1440]);
assert(
  three.map((a) => a.token).join(",") === "base,md,xl",
  `390/810/1440 -> ${three.map((a) => a.token)}`,
);
assert(three[0].minWidth === 0, "base min-width is 0");
assert(three[1].minWidth === 768 && three[2].minWidth === 1280, "md=768 xl=1280");
// The returned index points back to the caller's original array order.
assert(three.every((a, i) => a.index === i), "index preserved for already-sorted input");

// Input order does not matter; assignment is by width.
const shuffled = assignBreakpoints([1440, 390, 810]);
const byIndex = [...shuffled].sort((a, b) => a.index - b.index).map((a) => a.token);
assert(byIndex.join(",") === "xl,base,md", `shuffled maps back by index -> ${byIndex}`);

// Two near-equal widths still get distinct, strictly increasing tokens.
// 1300 snaps to xl (1280 <= 1300); the smaller is always base.
const collide = assignBreakpoints([1200, 1300]);
assert(
  collide[0].token === "base" && collide[1].token === "xl",
  `1200/1300 -> ${collide.map((a) => a.token)}`,
);

// A frame narrower than the next standard token above prev still advances.
const tight = assignBreakpoints([360, 375, 390]);
assert(
  tight.map((a) => a.token).join(",") === "base,sm,md",
  `tiny steps advance -> ${tight.map((a) => a.token)}`,
);

// One frame is base only.
assert(
  assignBreakpoints([500]).map((a) => a.token).join(",") === "base",
  "single frame is base",
);

// More than six frames cannot be assigned.
let threw = false;
try {
  assignBreakpoints([100, 200, 300, 400, 500, 600, 700]);
} catch {
  threw = true;
}
assert(threw, "seven frames throws");

console.log("breakpoints: all checks passed");
