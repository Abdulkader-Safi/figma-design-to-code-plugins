// Headless self-check for emitMerged. Run: bun run test/merge-emit.ts
import { emitMerged } from "../src/merge-emit";
import type { MergedNode } from "../src/merge-model";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
}

// A title whose font-size grows from 32 (base) to 58 (xl), inside a root.
const title: MergedNode = {
  tag: "h1",
  className: "title-1",
  kind: "text",
  rulesByToken: { base: { "font-size": "32px", color: "#fff" }, xl: { "font-size": "58px", color: "#fff" } },
  presentAt: ["base", "xl"],
  children: [],
  textByToken: { base: "Digital Solutions", xl: "Digital Solutions" },
};
const root: MergedNode = {
  tag: "div",
  className: "root-0",
  kind: "element",
  rulesByToken: { base: { width: "390px", margin: "0 auto" }, xl: { width: "1440px", margin: "0 auto" } },
  presentAt: ["base", "xl"],
  children: [title],
};

// CSS mode.
const css = emitMerged(root, { title: "Home", tailwind: false, fonts: new Map(), pageBg: "#0c0b0a" });
assert(css.combined.includes(".title-1"), "base class emitted");
assert(css.combined.includes("font-size: 32px"), "base font-size present");
assert(/@media \(min-width: 1280px\)/.test(css.combined), "xl media query present");
// Only the changed property appears inside the media block.
const media = css.combined.slice(css.combined.indexOf("@media (min-width: 1280px)"));
assert(media.includes("font-size: 58px"), "xl override present");
assert(!media.includes("color:"), "unchanged color not restated at xl");
// Root is fluid, not pinned to 390px.
assert(css.combined.includes("width: 100%"), "root width is fluid");
assert(!/width: 390px/.test(css.combined), "root not pinned to base width");
assert(css.combined.includes("Digital Solutions"), "text content present");

// Tailwind mode.
const tw = emitMerged(root, { title: "Home", tailwind: true, fonts: new Map(), pageBg: "#0c0b0a" });
assert(tw.combined.includes("text-[32px]"), "base utility present");
assert(tw.combined.includes("xl:text-[58px]"), "prefixed override present");
assert(tw.combined.includes("w-full"), "root fluid in tailwind");

// A desktop-only node hides at base and shows at xl.
const sidebar: MergedNode = {
  tag: "aside",
  className: "side-2",
  kind: "element",
  rulesByToken: { xl: { display: "flex" } },
  presentAt: ["xl"],
  children: [],
};
const withSide: MergedNode = { ...root, children: [title, sidebar] };
const css2 = emitMerged(withSide, { title: "Home", tailwind: false, fonts: new Map(), pageBg: null });
const sideBase = css2.combined.slice(css2.combined.indexOf(".side-2"));
assert(sideBase.includes("display: none"), "desktop-only node hidden at base");

// Per-breakpoint text: differing strings become two toggled siblings.
const cta: MergedNode = {
  tag: "span",
  className: "cta-3",
  kind: "text",
  rulesByToken: { base: { color: "#fff" }, xl: { color: "#fff" } },
  presentAt: ["base", "xl"],
  children: [],
  textByToken: { base: "Sign up", xl: "Sign up for free" },
};
const withCta: MergedNode = { ...root, children: [cta] };
const css3 = emitMerged(withCta, { title: "Home", tailwind: false, fonts: new Map(), pageBg: null });
assert(css3.combined.includes("Sign up") && css3.combined.includes("Sign up for free"), "both text variants present");
assert(css3.combined.includes(".cta-3-t0") && css3.combined.includes(".cta-3-t1"), "two suffixed classes for the text variants");

// Text is placed as-is (the builder pre-renders mixed runs as inline-styled
// spans), so markup in the text must survive unescaped.
const mixed: MergedNode = {
  tag: "h1",
  className: "num-4",
  kind: "text",
  rulesByToken: { base: { "text-align": "left" } },
  presentAt: ["base"],
  children: [],
  textByToken: { base: '<span style="color:#fff">300</span><span style="color:#f5c518">+</span>' },
};
const css4 = emitMerged({ ...root, children: [mixed] }, { title: "Home", tailwind: false, fonts: new Map(), pageBg: null });
assert(css4.combined.includes('<span style="color:#fff">300</span>'), "mixed-run span kept raw, not escaped");

console.log("merge-emit: all checks passed");
