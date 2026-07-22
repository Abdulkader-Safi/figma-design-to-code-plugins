// Serialises a selected node tree to JSON so a design can be replayed outside
// Figma. The exporter reads a fixed set of node properties; this dumps exactly
// those, so a fixture is a faithful stand-in for the real tree and the whole
// generator can run headlessly against it in a test.
//
// Pixels are deliberately not included. Assets are recorded as a flag and their
// box, never as base64: a fixture is for checking structure, layout and style,
// and embedding PNGs would make it unusable (a real page runs to megabytes).

// figma.mixed is a symbol, so it cannot survive JSON. It travels as this marker
// and the replay side turns it back into the symbol.
export const MIXED_MARKER = "__figma_mixed__";

// Every property the generator reads, grouped the way Figma's own panel groups
// them. Anything absent on a given node type is simply skipped.
const PROPS = [
  // identity and visibility
  "id",
  "name",
  "type",
  "visible",
  "opacity",
  "blendMode",
  // position and transform
  "x",
  "y",
  "width",
  "height",
  "rotation",
  "relativeTransform",
  "constraints",
  // auto layout, on the parent
  "layoutMode",
  "layoutWrap",
  "primaryAxisAlignItems",
  "counterAxisAlignItems",
  "counterAxisAlignContent",
  "itemSpacing",
  "counterAxisSpacing",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "clipsContent",
  "itemReverseZIndex",
  "strokesIncludedInLayout",
  "layoutGrids",
  // grid auto layout, on the parent
  "gridRowCount",
  "gridColumnCount",
  "gridRowGap",
  "gridColumnGap",
  "gridRowSizes",
  "gridColumnSizes",
  "gridAutoTracks",
  "gridItemsPositioning",
  // grid auto layout, on the child
  "gridRowSpan",
  "gridColumnSpan",
  "gridRowAnchorIndex",
  "gridColumnAnchorIndex",
  "gridChildHorizontalAlign",
  "gridChildVerticalAlign",
  // auto layout, on the child
  "layoutPositioning",
  "layoutSizingHorizontal",
  "layoutSizingVertical",
  "layoutAlign",
  "layoutGrow",
  // fill and stroke
  "fills",
  "strokes",
  "strokeWeight",
  "strokeTopWeight",
  "strokeRightWeight",
  "strokeBottomWeight",
  "strokeLeftWeight",
  "strokeAlign",
  "strokeCap",
  "strokeJoin",
  "dashPattern",
  // corners
  "cornerRadius",
  "topLeftRadius",
  "topRightRadius",
  "bottomLeftRadius",
  "bottomRightRadius",
  "cornerSmoothing",
  // effects and shape
  "effects",
  "arcData",
  // text
  "characters",
  "fontName",
  "fontSize",
  "fontWeight",
  "textAlignHorizontal",
  "textAlignVertical",
  "textAutoResize",
  "textTruncate",
  "maxLines",
  "lineHeight",
  "letterSpacing",
  "paragraphSpacing",
  "paragraphIndent",
  "textCase",
  "textDecoration",
  "leadingTrim",
  "hyperlink",
] as const;

// The fields getStyledTextSegments is asked for. Kept in one place so the dump
// and the exporter cannot drift apart.
export const SEGMENT_FIELDS = [
  "fontName",
  "fontSize",
  "fills",
  "textDecoration",
  "textCase",
  "letterSpacing",
  "lineHeight",
] as const;

type Json = unknown;

// Replaces the mixed symbol and drops anything JSON cannot carry. Figma's
// property objects are plain data, so a structural walk is enough.
function plain(value: unknown, depth = 0): Json {
  if (value === figma.mixed) return MIXED_MARKER;
  if (value === null || value === undefined) return null;
  if (depth > 8) return null;
  const t = typeof value;
  if (t === "number" || t === "string" || t === "boolean") return value;
  if (t === "symbol" || t === "function") return null;
  if (Array.isArray(value)) return value.map((v) => plain(v, depth + 1));
  if (t === "object") {
    const out: Record<string, Json> = {};
    for (const k of Object.keys(value as object)) {
      const v = plain((value as Record<string, unknown>)[k], depth + 1);
      if (v !== null) out[k] = v;
    }
    return out;
  }
  return null;
}

export interface FixtureNode {
  [key: string]: Json;
  children?: FixtureNode[];
}

export function dumpNode(node: SceneNode): FixtureNode {
  const out: FixtureNode = {};
  for (const key of PROPS) {
    if (!(key in node)) continue;
    let raw: unknown;
    try {
      raw = (node as unknown as Record<string, unknown>)[key];
    } catch {
      continue; // some properties throw on unsupported node types
    }
    const v = plain(raw);
    if (v !== null) out[key] = v;
  }

  // absoluteBoundingBox is what rotated nodes are measured by, and it is
  // canvas-space, so it has to travel alongside the node's own box.
  if ("absoluteBoundingBox" in node && node.absoluteBoundingBox) {
    out.absoluteBoundingBox = plain(node.absoluteBoundingBox);
  }

  // Per-run text styling. A node with one run still reports one segment; the
  // exporter branches on the count, so record it as Figma gives it.
  if (node.type === "TEXT") {
    try {
      out.segments = plain(
        node.getStyledTextSegments(SEGMENT_FIELDS as unknown as never),
      );
    } catch {
      out.segments = [];
    }
  }

  if ("children" in node) out.children = node.children.map(dumpNode);
  return out;
}

// One selection -> one fixture file. `frames` mirrors what the exporter was
// given, so a multi-frame set replays as a set.
export function dumpFixture(frames: readonly SceneNode[]): string {
  return JSON.stringify(
    {
      version: 1,
      pluginApi: figma.apiVersion ?? "unknown",
      frames: frames.map(dumpNode),
    },
    null,
    2,
  );
}
