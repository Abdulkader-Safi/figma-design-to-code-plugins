// End-to-end self-check: fake Figma frames in, HTML out. Run: bun run test/merge-tree.ts
//
// The unit suites cover the merge algorithms in isolation, but every regression
// so far only showed up once buildMergedTree and emitMerged ran together against
// a real frame shape. This drives both, so a structural break is caught here
// instead of in an exported file.
//
// The Figma surface the pipeline touches is tiny: figma.mixed, base64Encode,
// exportAsync and getStyledTextSegments. Stub it before importing anything.
const MIXED = Symbol("figma.mixed");
(globalThis as unknown as { figma: unknown }).figma = {
  mixed: MIXED,
  base64Encode: () => "STUB",
  getImageByHash: (hash: string) =>
    hash
      ? {
          getBytesAsync: async () => new Uint8Array([0, 0, 0]),
          getSizeAsync: async () => ({ width: 64, height: 64 }),
        }
      : null,
};

const { buildMergedTree } = await import("../src/merge-build");
const { emitMerged } = await import("../src/merge-emit");
const { createImageStore } = await import("../src/paint");

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
}

type Fake = Record<string, unknown>;

const BOX: Fake = {
  type: "FRAME",
  visible: true,
  x: 0,
  y: 0,
  width: 100,
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
  paddingLeft: 0,
  paddingRight: 0,
  paddingTop: 0,
  paddingBottom: 0,
  fills: [],
  strokes: [],
  effects: [],
  cornerRadius: 0,
  clipsContent: false,
};

const frame = (name: string, o: Fake = {}): SceneNode =>
  ({ ...BOX, name, children: [], ...o }) as never as SceneNode;

// A column of children, which is what every section in the design actually is.
const column = (name: string, children: SceneNode[], o: Fake = {}): SceneNode =>
  frame(name, {
    layoutMode: "VERTICAL",
    layoutSizingHorizontal: "FILL",
    layoutSizingVertical: "HUG",
    children,
    ...o,
  });

const row = (name: string, children: SceneNode[], o: Fake = {}): SceneNode =>
  column(name, children, { layoutMode: "HORIZONTAL", ...o });

// A frame carrying an image fill: hasImageFill sends it out as an <img>.
const image = (name: string, o: Fake = {}): SceneNode =>
  frame(name, {
    fills: [{ type: "IMAGE", visible: true, scaleMode: "FILL" }],
    exportAsync: async () => new Uint8Array([1, 2, 3]),
    ...o,
  });

const text = (name: string, characters: string, o: Fake = {}): SceneNode =>
  frame(name, {
    type: "TEXT",
    characters,
    textAutoResize: "NONE",
    textAlignHorizontal: "LEFT",
    fontName: { family: "Roboto Flex", style: "Bold" },
    fontSize: 28,
    fontWeight: 700,
    textCase: "ORIGINAL",
    textDecoration: "NONE",
    letterSpacing: { unit: "PIXELS", value: 0 },
    lineHeight: { unit: "AUTO" },
    hyperlink: null,
    getStyledTextSegments: () => [],
    ...o,
  });

const noop = () => {};

// The services hero, as the real file is built. Mobile stacks one card holding
// the copy over a separate image; laptop splits the copy into its own panel
// beside the image. Both frames call their halves "Sub Container", so name alone
// cannot tell the mobile image from the laptop text panel.
const mobileHero = column(
  "Container",
  [
    column("Container", [text("Heading", "Our Comprehensive Digital Solutions")], {
      width: 358,
      height: 500,
    }),
    image("Sub Container", { width: 358, height: 300 }),
  ],
  { width: 358, height: 805 },
);
const laptopHero = row(
  "Container",
  [
    column("Sub Container", [text("Heading", "Our Comprehensive Digital Solutions")], {
      width: 900,
      height: 667,
    }),
    image("Sub Container", { width: 443, height: 667 }),
  ],
  { width: 1360, height: 667 },
);

const mobileFrame = column("Services Page", [mobileHero], { width: 390, height: 900 });
const laptopFrame = column("Services Page", [laptopHero], { width: 1440, height: 800 });

const tree = await buildMergedTree(
  [
    { frame: mobileFrame as never, token: "base", variant: "Mobile", width: 390 },
    { frame: laptopFrame as never, token: "lg", variant: "Laptop", width: 1440 },
  ] as never,
  { semantic: true },
  noop,
);

const hero = tree.children[0];
assert(hero !== undefined, "the hero survived the merge");

// Every child of the hero, flattened, with what it is and where it shows.
const kids = hero.children.map((c) => ({
  cls: c.className,
  kind: c.kind,
  at: c.presentAt.join(","),
}));

// The mobile card has no laptop counterpart, so it is mobile-only.
const card = kids.find((k) => k.cls.startsWith("container-"));
assert(card !== undefined && card.at === "base", `mobile card is base only: ${JSON.stringify(kids)}`);

// The two images are ONE node present at both, not a duplicate pair.
const imgs = hero.children.filter((c) => c.kind === "asset");
assert(imgs.length === 1, `the image merges into one node, got ${imgs.length}`);
assert(imgs[0].presentAt.join(",") === "base,lg", `image present at both: ${imgs[0].presentAt}`);

// The laptop text panel stays a container. Pairing it with the mobile image
// exported it as a stretched <img> with the copy gone.
const panel = hero.children.find((c) => c.kind === "element" && c.presentAt.join(",") === "lg");
assert(panel !== undefined, `the laptop panel is its own lg-only element: ${JSON.stringify(kids)}`);
assert(panel!.children.length === 1, "the panel kept its heading");

// Order matters: the panel is spliced at its own index, so it renders before the
// image rather than being pushed past it.
const order = hero.children.map((c) => c.className);
assert(
  order.indexOf(panel!.className) < order.indexOf(imgs[0].className),
  `panel before image: ${order}`,
);

// Fill layers have to survive the merge. They were being dropped, so a
// responsive export gave a blended section `isolation: isolate` and no
// background at all: the node isolated against nothing.
const banner = (w: number, blend: string) =>
  column("Banner", [text("T", "hi")], {
    width: w,
    height: 200,
    fills: [
      {
        type: "IMAGE",
        visible: true,
        scaleMode: "FILL",
        imageHash: "tex",
        opacity: 1,
        blendMode: blend,
      },
      { type: "SOLID", visible: true, color: { r: 0, g: 0, b: 0 }, opacity: 0.5 },
    ],
  });
const layerTree = await buildMergedTree(
  [
    {
      frame: column("Page", [banner(390, "OVERLAY")], { width: 390, height: 900 }) as never,
      token: "base",
      variant: "Mobile",
      width: 390,
    },
    {
      frame: column("Page", [banner(1440, "OVERLAY")], { width: 1440, height: 800 }) as never,
      token: "lg",
      variant: "Laptop",
      width: 1440,
    },
  ] as never,
  { semantic: true, backdrop: "#101010", images: createImageStore() },
  noop,
);
const merged = layerTree.children[0];
const layers = merged.children.filter((c) => c.className.includes("-fill"));
assert(layers.length === 3, `backdrop plus two paints came through, got ${layers.length}`);
assert(layers[0].className.endsWith("-fillbase"), "the backdrop layer sorts first");
assert(
  layers.every((l) => l.presentAt.join(",") === "base,lg"),
  "each layer is present at both breakpoints",
);
assert(
  merged.children.indexOf(layers[2]) < merged.children.findIndex((c) => c.kind === "text"),
  "layers render before the real children",
);
const layerCss = emitMerged(layerTree, {
  title: "L",
  tailwind: false,
  fonts: new Map(),
  pageBg: "#101010",
}).combined;
assert(layerCss.includes("mix-blend-mode: overlay"), "the blend mode reaches the document");
assert(layerCss.includes("background: #101010"), "the backdrop colour reaches the document");

// And the whole thing emits: capped, centred, with the copy intact.
const out = emitMerged(tree, {
  title: "Services",
  tailwind: false,
  fonts: new Map(),
  pageBg: "#0f0f0f",
});
assert(out.combined.includes("max-width: 1440px"), "root capped at the widest frame");
assert(out.combined.includes("margin: 0 auto"), "root centred");
assert(
  out.combined.includes("Our Comprehensive Digital Solutions"),
  "the headline reached the document",
);
assert((out.combined.match(/<img /g) || []).length === 1, "one img, not one per frame");

console.log("merge-tree: all checks passed");
