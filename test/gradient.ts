// Headless self-check for gradientFill (no framework). Run: bun run test/gradient.ts
// gradientFill makes no figma.* runtime calls, so it runs outside Figma.
import { gradientFill } from "../src/values";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
}

const stops = [
  { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
  { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 },
];
// Minimal fake gradient paint; only the fields gradientFill reads matter.
const paint = (type: string, transform: number[][]) =>
  [
    { type, visible: true, gradientTransform: transform, gradientStops: stops },
  ] as never;

const IDENTITY = [
  [1, 0, 0],
  [0, 1, 0],
];
const VERTICAL = [
  [0, 1, 0],
  [1, 0, 0],
];

const linH = gradientFill(paint("GRADIENT_LINEAR", IDENTITY))!;
assert(linH.includes("linear-gradient(90deg"), `identity linear -> 90deg: ${linH}`);

const linV = gradientFill(paint("GRADIENT_LINEAR", VERTICAL))!;
assert(linV.includes("linear-gradient(180deg"), `vertical linear -> 180deg: ${linV}`);

const rad = gradientFill(paint("GRADIENT_RADIAL", IDENTITY))!;
assert(rad.includes("radial-gradient("), `radial -> radial-gradient: ${rad}`);
assert(rad.includes("50% 50%"), `radial identity center -> 50% 50%: ${rad}`);

const ang = gradientFill(paint("GRADIENT_ANGULAR", IDENTITY))!;
assert(
  ang.includes("conic-gradient(from 0deg at 50% 50%"),
  `angular -> conic: ${ang}`,
);

const dia = gradientFill(paint("GRADIENT_DIAMOND", IDENTITY))!;
assert(dia.includes("radial-gradient("), `diamond -> radial fallback: ${dia}`);

for (const out of [linH, linV, rad, ang, dia]) {
  assert(
    out.includes("#ff0000") && out.includes("#0000ff"),
    `all stops present: ${out}`,
  );
}

console.log("gradient.ts: all checks passed");
