// Round-trip self-check for the fixture loop. Run: bun run test/fixture.ts
//
// A frame goes out as JSON, comes back through the replay hydrator, and drives
// the real exporter. If this passes, a fixture a designer dumps from Figma is
// enough to reproduce and fix their layout here, with no export-and-send round
// trip. Importing replay first installs the figma stub.
import { assert, BOX, hydrateFrames, loadFixture, type Fake } from "./fakes";

const { dumpFixture, MIXED_MARKER } = await import("../src/fixture");
const { generate } = await import("../src/generate");




const heading = {
  ...BOX,
  name: "Heading",
  type: "TEXT",
  width: 300,
  height: 40,
  characters: "Our Comprehensive Digital Solutions",
  textAutoResize: "NONE",
  textAlignHorizontal: "LEFT",
  fontName: { family: "Roboto Flex", style: "Bold" },
  fontSize: 32,
  textCase: "UPPER",
  textDecoration: "NONE",
  letterSpacing: { unit: "PIXELS", value: 0 },
  lineHeight: { unit: "PERCENT", value: 150 },
  hyperlink: null,
  children: undefined,
  getStyledTextSegments: () => [],
};
delete (heading as Fake).children;

const card = {
  ...BOX,
  name: "Card",
  width: 1360,
  height: 200,
  layoutMode: "VERTICAL",
  layoutSizingHorizontal: "FILL",
  layoutSizingVertical: "HUG",
  itemSpacing: 16,
  paddingTop: 40,
  paddingLeft: 40,
  cornerRadius: 16,
  fills: [{ type: "SOLID", visible: true, color: { r: 0.1, g: 0.1, b: 0.1 }, opacity: 1 }],
  children: [heading],
};

const frame = {
  ...BOX,
  name: "Services Page",
  width: 1440,
  height: 900,
  layoutMode: "VERTICAL",
  itemSpacing: 40,
  fills: [{ type: "SOLID", visible: true, color: { r: 0, g: 0, b: 0 }, opacity: 1 }],
  children: [card],
};

// Dump, then reload through JSON exactly as the plugin and I would.
const [live] = hydrateFrames([frame as never]);
const json = dumpFixture([live]);
assert(json.length > 0, "the dump produced something");
const parsed = JSON.parse(json) as { version: number; frames: unknown[] };
assert(parsed.version === 1, "the fixture is versioned");
assert(parsed.frames.length === 1, "one frame in, one frame out");
assert(!json.includes("base64"), "no pixels travel in a fixture");

// Through a real file, which is how a dumped fixture actually arrives: it is
// the only caller loadFixture has, and an entry point with no caller rots.
const tmp = `/tmp/design-to-html-fixture-${Bun.hash(json)}.json`;
await Bun.write(tmp, json);
const fromDisk = await loadFixture(tmp);
assert(fromDisk.version === 1, "loadFixture read the version back");
const [replayed] = fromDisk.frames;
assert((replayed as unknown as Fake).name === "Services Page", "the frame survived the round trip");

// The real exporter runs against the replayed tree.
const out = await generate(replayed, { semantic: true, tailwind: false });
assert(out.combined.includes("<!DOCTYPE html>"), "a document came out");
assert(
  out.combined.includes("Our Comprehensive Digital Solutions"),
  "the copy reached the document",
);
assert(out.combined.includes("border-radius: 16px"), "the card kept its radius");
assert(out.combined.includes("padding: 40px 0px 0px 40px"), "the card kept its padding");
assert(out.combined.includes("text-transform: uppercase"), "the heading kept its case");
assert(out.combined.includes("gap: 40px"), "the page kept its spacing");

// figma.mixed has to survive JSON, or every mixed-styled node replays wrong.
const mixedText = { ...heading, fontSize: MIXED_MARKER } as unknown as Fake;
const [mixedLive] = hydrateFrames([mixedText as never]);
const round = JSON.parse(dumpFixture([mixedLive])) as { frames: Fake[] };
assert(round.frames[0].fontSize === MIXED_MARKER, "mixed round-trips as its marker");

console.log("fixture: all checks passed");
