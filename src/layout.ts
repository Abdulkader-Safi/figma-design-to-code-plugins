// Position, size, and flexbox: maps Figma auto-layout to flexbox, and static
// frames plus "ignore auto layout" children to absolute positioning.

import type { Rule } from "./types";
import { round } from "./values";

const rotationOf = (n: SceneNode): number =>
  "rotation" in n && typeof n.rotation === "number" ? n.rotation : 0;

// Figma measures width/height in the node's own space, BEFORE rotation, so a
// rotated node's numbers don't describe the box it lands in: a 577px line turned
// 90 degrees still reports 577x0 while occupying 1x577 on screen. Its
// absoluteBoundingBox is the real box. Both boxes are in canvas coordinates, so
// subtracting the parent's puts it back in the parent's frame.
function renderedBox(node: SceneNode, parent: SceneNode | null) {
  const b = "absoluteBoundingBox" in node ? node.absoluteBoundingBox : null;
  if (!b) return null;
  const p =
    parent && "absoluteBoundingBox" in parent
      ? parent.absoluteBoundingBox
      : null;
  return {
    x: p ? b.x - p.x : b.x,
    y: p ? b.y - p.y : b.y,
    w: Math.round(b.width),
    h: Math.round(b.height),
  };
}

export function positionAndSize(
  node: SceneNode,
  parent: SceneNode | null,
  absolute: boolean,
  baked: boolean,
  rule: Rule,
) {
  const spun = Math.abs(rotationOf(node)) > 0.01;
  // A rotated node exported as an asset already carries the rotation inside the
  // SVG/PNG, so it wants the box it renders into. A rotated node rebuilt out of
  // CSS keeps its own box and gets the rotation back as a transform below.
  const box = spun && baked ? renderedBox(node, parent) : null;
  const w = box ? box.w : "width" in node ? Math.round(node.width) : undefined;
  const h = box ? box.h : "height" in node ? Math.round(node.height) : undefined;

  if (parent === null) {
    rule.position = "relative";
    rule.margin = "0 auto";
    if (w !== undefined) rule.width = `${w}px`;
    if (h !== undefined) rule.height = `${h}px`;
    return;
  }

  if (absolute) {
    rule.position = "absolute";
    rule.left = `${Math.round(box ? box.x : node.x)}px`;
    rule.top = `${Math.round(box ? box.y : node.y)}px`;
    if (w !== undefined) rule.width = `${w}px`;
    if (h !== undefined) rule.height = `${h}px`;
    // Figma's relativeTransform maps the node's own (0,0) to (x,y), which is
    // exactly what left/top plus a top-left origin do here, so the matrix drops
    // straight in: no rotation sign or centre of rotation to second-guess.
    if (spun && !baked && "relativeTransform" in node) {
      const t = node.relativeTransform;
      rule.transform =
        `matrix(${round(t[0][0])}, ${round(t[1][0])}, ` +
        `${round(t[0][1])}, ${round(t[1][1])}, 0, 0)`;
      rule["transform-origin"] = "0 0";
    }
    return;
  }

  // A grid child is placed by its anchor and span, not by flex sizing. Figma's
  // anchor indices are 0-based; CSS grid lines start at 1.
  if ("layoutMode" in parent && (parent.layoutMode as string) === "GRID") {
    const g = node as unknown as {
      gridColumnAnchorIndex?: number;
      gridRowAnchorIndex?: number;
      gridColumnSpan?: number;
      gridRowSpan?: number;
      gridChildHorizontalAlign?: string;
      gridChildVerticalAlign?: string;
    };
    const col = (g.gridColumnAnchorIndex ?? 0) + 1;
    const row = (g.gridRowAnchorIndex ?? 0) + 1;
    rule["grid-column"] = `${col} / span ${Math.max(1, g.gridColumnSpan ?? 1)}`;
    rule["grid-row"] = `${row} / span ${Math.max(1, g.gridRowSpan ?? 1)}`;
    const js = GRID_ALIGN[g.gridChildHorizontalAlign ?? ""];
    const as = GRID_ALIGN[g.gridChildVerticalAlign ?? ""];
    if (js) rule["justify-self"] = js;
    if (as) rule["align-self"] = as;
    // A track already sizes the cell, so only an explicitly fixed child pins its
    // own box; HUG and FILL are the track's job.
    if ("layoutSizingHorizontal" in node && node.layoutSizingHorizontal === "FIXED" && w !== undefined)
      rule.width = `${w}px`;
    if ("layoutSizingVertical" in node && node.layoutSizingVertical === "FIXED" && h !== undefined)
      rule.height = `${h}px`;
    return;
  }

  // In an auto-layout parent: honour Figma's hug / fill / fixed sizing.
  const hParent = "layoutMode" in parent && parent.layoutMode === "HORIZONTAL";
  const vParent = "layoutMode" in parent && parent.layoutMode === "VERTICAL";
  const hSize = (
    "layoutSizingHorizontal" in node ? node.layoutSizingHorizontal : "FIXED"
  ) as string;
  const vSize = (
    "layoutSizingVertical" in node ? node.layoutSizingVertical : "FIXED"
  ) as string;

  // A flex item defaults to min-width/min-height: auto, which floors it at its
  // content's intrinsic size. An <img> is the painful case: its intrinsic width
  // is the exported PNG's pixel width (twice the design size, since we export at
  // 2x), so a filling image refuses to shrink to its share and shoves its
  // siblings out of the row. Figma has no such floor, so clear it on the axis
  // the item flexes along.
  if (hSize === "FILL") {
    if (hParent) {
      rule.flex = "1 1 0";
      rule["min-width"] = "0";
    } else rule["align-self"] = "stretch";
  } else if (hSize === "FIXED" && w !== undefined) rule.width = `${w}px`;

  if (vSize === "FILL") {
    if (vParent) {
      rule.flex = "1 1 0";
      rule["min-height"] = "0";
    } else rule["align-self"] = "stretch";
  } else if (vSize === "FIXED" && h !== undefined) rule.height = `${h}px`;

  // Figma auto-layout items keep their size; CSS flex items shrink to fit by
  // default. Lock the main-axis size unless it's FILL, so a fixed-height (or
  // fixed-width) parent can't squish content, e.g. an image band collapsing.
  const mainSize = hParent ? hSize : vSize;
  if (mainSize !== "FILL") rule["flex-shrink"] = 0;
}

const PRIMARY: { [k: string]: string } = {
  MIN: "flex-start",
  CENTER: "center",
  MAX: "flex-end",
  SPACE_BETWEEN: "space-between",
};
const COUNTER: { [k: string]: string } = {
  MIN: "flex-start",
  CENTER: "center",
  MAX: "flex-end",
  BASELINE: "baseline",
};

// A Figma grid track -> a CSS track. HUG is fit-content(100%) per the API docs;
// FLEX is the fr unit, which is what Figma's own "Flex" track means.
function trackCss(t: { type: string; value?: number }): string {
  if (t.type === "FLEX") return `${t.value ?? 1}fr`;
  if (t.type === "FIXED") return `${Math.round(t.value ?? 0)}px`;
  return "fit-content(100%)";
}

// Figma does not document the literal set for grid child alignment, so both the
// MIN/MAX and START/END spellings are accepted and anything else is left alone.
const GRID_ALIGN: { [k: string]: string } = {
  MIN: "start",
  START: "start",
  CENTER: "center",
  MAX: "end",
  END: "end",
  STRETCH: "stretch",
  BASELINE: "baseline",
};

// Figma's grid auto layout. Its own gaps and track lists replace the flex
// properties entirely: itemSpacing and the axis alignments do not apply here.
function applyGrid(n: FrameNode, rule: Rule) {
  const g = n as unknown as {
    gridColumnSizes?: { type: string; value?: number }[];
    gridRowSizes?: { type: string; value?: number }[];
    gridColumnCount?: number;
    gridRowCount?: number;
    gridColumnGap?: number;
    gridRowGap?: number;
    gridAutoTracks?: string;
    gridItemsPositioning?: string;
  };
  rule.display = "grid";

  const cols = g.gridColumnSizes?.length
    ? g.gridColumnSizes.map(trackCss).join(" ")
    : g.gridColumnCount
      ? `repeat(${g.gridColumnCount}, 1fr)`
      : null;
  if (cols) rule["grid-template-columns"] = cols;

  // Rows are only pinned when Figma actually defines them. gridAutoTracks 'ROWS'
  // means new rows are created implicitly, which is grid-auto-rows in CSS.
  const rows = g.gridRowSizes?.length ? g.gridRowSizes.map(trackCss).join(" ") : null;
  if (rows) rule["grid-template-rows"] = rows;
  if (g.gridAutoTracks === "ROWS") rule["grid-auto-rows"] = "auto";
  if (g.gridItemsPositioning === "ROW_AUTO_FLOW") rule["grid-auto-flow"] = "row";

  if (g.gridColumnGap) rule["column-gap"] = `${Math.round(g.gridColumnGap)}px`;
  if (g.gridRowGap) rule["row-gap"] = `${Math.round(g.gridRowGap)}px`;
}

export function applyLayout(node: SceneNode, rule: Rule) {
  if (!("layoutMode" in node) || node.layoutMode === "NONE") return;
  const n = node as FrameNode;

  const pad = [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft];
  if (pad.some((p) => p > 0))
    rule.padding = pad.map((p) => `${Math.round(p)}px`).join(" ");

  if ((n.layoutMode as string) === "GRID") {
    applyGrid(n, rule);
    return;
  }

  rule.display = "flex";
  rule["flex-direction"] = n.layoutMode === "VERTICAL" ? "column" : "row";
  rule["justify-content"] = PRIMARY[n.primaryAxisAlignItems] || "flex-start";
  rule["align-items"] = COUNTER[n.counterAxisAlignItems] || "flex-start";

  const wrapping = "layoutWrap" in n && n.layoutWrap === "WRAP";
  if (wrapping) {
    rule["flex-wrap"] = "wrap";
    // Lines and items align independently. Leaving align-content at its
    // `stretch` default silently stretches every line, which is the usual way a
    // wrapped layout comes out wrong.
    const content = n.counterAxisAlignContent;
    rule["align-content"] =
      content === "SPACE_BETWEEN"
        ? "space-between"
        : COUNTER[n.counterAxisAlignItems] || "flex-start";
  }

  // SPACE_BETWEEN distributes the free space itself; Figma shows the gap as
  // "Auto" and ignores the stored value, so nothing is emitted here.
  if (n.primaryAxisAlignItems === "SPACE_BETWEEN") return;

  const gap = Math.round(n.itemSpacing);
  // The cross-axis gap between wrapped lines is a separate Figma property and is
  // always positive, so it maps straight to row-gap.
  const cross = wrapping ? (n.counterAxisSpacing ?? n.itemSpacing) : null;

  if (gap >= 0) {
    if (wrapping) {
      if (gap > 0) rule["column-gap"] = `${gap}px`;
      if (cross) rule["row-gap"] = `${Math.round(cross)}px`;
    } else if (gap > 0) rule.gap = `${gap}px`;
    return;
  }

  // Negative gap: the children overlap. CSS `gap` cannot go negative, so nothing
  // is emitted here; the spacing moves to sibling margins, which shrink the
  // container's content size the same way Figma's negative spacing does. The
  // caller applies overlapMargin and overlapZIndex to each child.
  if (cross) rule["row-gap"] = `${Math.round(cross)}px`;
}

// The margin one child needs so its parent's negative gap overlaps it onto the
// previous sibling. Index 0 gets nothing, since there is nothing to overlap.
// Both this and overlapZIndex return nothing unless the parent's gap is
// negative, so callers can apply them to every child unconditionally.
export function overlapMargin(parent: SceneNode, index: number): Rule {
  if (index === 0 || !("layoutMode" in parent)) return {};
  const n = parent as FrameNode;
  const gap = Math.round(n.itemSpacing ?? 0);
  if (gap >= 0 || n.primaryAxisAlignItems === "SPACE_BETWEEN") return {};
  return n.layoutMode === "VERTICAL" ? { "margin-top": `${gap}px` } : { "margin-left": `${gap}px` };
}

// Overlapping children need an explicit paint order. Figma's default is that the
// last child wins; "Canvas stacking: First on top" (itemReverseZIndex) flips it.
export function overlapZIndex(parent: SceneNode, index: number, total: number): Rule {
  if (!("layoutMode" in parent)) return {};
  const n = parent as FrameNode;
  if (Math.round(n.itemSpacing ?? 0) >= 0) return {};
  const reverse = "itemReverseZIndex" in n && n.itemReverseZIndex;
  return { position: "relative", "z-index": String(reverse ? total - index : index + 1) };
}
