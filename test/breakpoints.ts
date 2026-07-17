// Headless self-check for assignBreakpoints. Run: bun run test/breakpoints.ts
import { assignBreakpoints } from "../src/breakpoints";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
}

// Smallest is base; each larger layout activates near the midpoint between it
// and the next-smaller frame, snapped to the nearest standard token.
// mobile 390 / tablet 810 / desktop 1440:
//   tablet midpoint (390+810)/2 = 600 -> nearest sm (640)
//   desktop midpoint (810+1440)/2 = 1125 -> nearest lg (1024)
const three = assignBreakpoints([390, 810, 1440]);
assert(
  three.map((a) => a.token).join(",") === "base,sm,lg",
  `390/810/1440 -> ${three.map((a) => a.token)}`,
);
assert(three[0].minWidth === 0, "base min-width is 0");
assert(three[1].minWidth === 640 && three[2].minWidth === 1024, "sm=640 lg=1024");
// The returned index points back to the caller's original array order.
assert(three.every((a, i) => a.index === i), "index preserved for already-sorted input");

// Input order does not matter; assignment is by width.
const shuffled = assignBreakpoints([1440, 390, 810]);
const byIndex = [...shuffled].sort((a, b) => a.index - b.index).map((a) => a.token);
assert(byIndex.join(",") === "lg,base,sm", `shuffled maps back by index -> ${byIndex}`);

// A mobile + desktop pair switches around the midpoint, not at the desktop
// width: (390+1440)/2 = 915 -> nearest lg (1024), so desktop shows from 1024 up.
const pair = assignBreakpoints([390, 1440]);
assert(
  pair[1].token === "lg" && pair[1].minWidth === 1024,
  `390/1440 -> ${pair.map((a) => a.token)}`,
);

// Two near-equal widths still get distinct, strictly increasing tokens.
// midpoint 1250 -> nearest xl (1280); the smaller is always base.
const collide = assignBreakpoints([1200, 1300]);
assert(
  collide[0].token === "base" && collide[1].token === "xl",
  `1200/1300 -> ${collide.map((a) => a.token)}`,
);

// Tiny steps still advance to distinct tokens, smallest available above prev.
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
