// Fake Figma nodes for the headless suites.
//
// Importing this installs the Figma stub as a side effect, so it has to come
// before any dynamic import of src/. All three suites used to carry their own
// copy of the box below and their own stub, which drifted: one of them still
// lacked getImageByHash long after image fills started resolving through it.

import "./replay";

export { hydrateFrames, loadFixture } from "./replay";

export function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error("FAIL: " + msg);
}

export type Fake = Record<string, unknown>;

// Every property the exporter reads on a plain frame, at its Figma default.
// Spread it and override only what a test is actually about.
export const BOX: Fake = {
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
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  fills: [],
  strokes: [],
  effects: [],
  cornerRadius: 0,
  clipsContent: false,
};

// The two methods the exporter calls on a node. A fake can be handed straight to
// the builder or round-tripped through hydrateFrames, which overwrites them with
// its own; either way they are always there.
const svgOf = (w: number, h: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"></svg>`;

export const frame = (name: string, o: Fake = {}): Fake => {
  const n: Fake = { ...BOX, name, children: [], ...o };
  n.exportAsync = async (opts?: { format?: string }) =>
    opts?.format === "SVG_STRING"
      ? svgOf(Number(n.width) || 1, Number(n.height) || 1)
      : new Uint8Array([0, 0, 0]);
  return n;
};

// The shape every real section turns out to be: an auto-layout column that
// fills its parent and hugs its content.
export const column = (name: string, children: Fake[], o: Fake = {}): Fake =>
  frame(name, {
    layoutMode: "VERTICAL",
    layoutSizingHorizontal: "FILL",
    layoutSizingVertical: "HUG",
    children,
    ...o,
  });

export const row = (name: string, children: Fake[], o: Fake = {}): Fake =>
  column(name, children, { layoutMode: "HORIZONTAL", ...o });

// A text node. Leaves have no children key at all, which is what the
// leaf-versus-branch checks in the matcher read.
export const text = (name: string, characters: string, o: Fake = {}): Fake => {
  const t = frame(name, {
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
    ...o,
  });
  delete t.children;
  t.getStyledTextSegments = () => [];
  return t;
};

// --- paints -----------------------------------------------------------------

export const solidPaint = (r: number, g: number, b: number, opacity = 1, blendMode?: string): Fake => ({
  type: "SOLID",
  visible: true,
  color: { r, g, b },
  opacity,
  ...(blendMode ? { blendMode } : {}),
});

export const imagePaint = (opacity = 1, blendMode?: string, extra: Fake = {}): Fake => ({
  type: "IMAGE",
  visible: true,
  scaleMode: "FILL",
  imageHash: "abc",
  opacity,
  ...(blendMode ? { blendMode } : {}),
  ...extra,
});

// A leaf frame carrying an image fill, which the exporter turns into an <img>.
export const imageNode = (name: string, o: Fake = {}): Fake => {
  const n = frame(name, { fills: [imagePaint()], ...o });
  delete n.children;
  return n;
};
