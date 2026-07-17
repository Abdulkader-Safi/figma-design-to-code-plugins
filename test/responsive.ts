// Headless self-check for planExport / parseFrameName. Run: bun run test/responsive.ts
import { parseFrameName, planExport } from "../src/responsive";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
}

// Only name + width are read; type is assumed already filtered by the caller.
const f = (name: string, width: number) => ({ name, width }) as never as SceneNode;

// Split on the LAST " - " only.
assert(parseFrameName("Home Page - Desktop").prefix === "Home Page", "prefix before last dash");
assert(parseFrameName("Home Page - Desktop").variant === "Desktop", "variant after last dash");
assert(parseFrameName("A - B - Mobile").prefix === "A - B", "only the last delimiter splits");
assert(parseFrameName("Landing").variant === "", "no delimiter means empty variant");

// One exportable frame -> single-frame plan (unchanged behaviour).
const single = planExport([f("Landing", 1440)]);
assert(single.kind === "single", `one frame is single, got ${single.kind}`);

// A clean set -> responsive, sorted base-first with assigned tokens.
const set = planExport([f("Home - Desktop", 1440), f("Home - Mobile", 390), f("Home - Tablet", 810)]);
assert(set.kind === "responsive", `clean set is responsive, got ${set.kind}`);
if (set.kind === "responsive") {
  assert(set.name === "Home", `set name is the shared prefix, got ${set.name}`);
  assert(
    set.variants.map((v) => v.token).join(",") === "base,sm,lg",
    `tokens -> ${set.variants.map((v) => v.token)}`,
  );
  assert(set.variants[0].variant === "Mobile", "base is the smallest (Mobile)");
}

// Two prefixes -> error, never a silent guess.
const mixed = planExport([f("Home - Desktop", 1440), f("Pricing - Mobile", 390)]);
assert(mixed.kind === "error", `two prefixes error, got ${mixed.kind}`);

// A valid set plus a stray singleton of another prefix -> error.
const stray = planExport([f("Home - Desktop", 1440), f("Home - Mobile", 390), f("About", 800)]);
assert(stray.kind === "error", `stray singleton errors, got ${stray.kind}`);

console.log("responsive: all checks passed");
