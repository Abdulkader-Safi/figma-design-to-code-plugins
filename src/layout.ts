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

  // In an auto-layout parent: honour Figma's hug / fill / fixed sizing.
  const hParent = "layoutMode" in parent && parent.layoutMode === "HORIZONTAL";
  const vParent = "layoutMode" in parent && parent.layoutMode === "VERTICAL";
  const hSize = (
    "layoutSizingHorizontal" in node ? node.layoutSizingHorizontal : "FIXED"
  ) as string;
  const vSize = (
    "layoutSizingVertical" in node ? node.layoutSizingVertical : "FIXED"
  ) as string;

  if (hSize === "FILL")
    rule[hParent ? "flex" : "align-self"] = hParent ? "1 1 0" : "stretch";
  else if (hSize === "FIXED" && w !== undefined) rule.width = `${w}px`;

  if (vSize === "FILL")
    rule[vParent ? "flex" : "align-self"] = vParent ? "1 1 0" : "stretch";
  else if (vSize === "FIXED" && h !== undefined) rule.height = `${h}px`;

  // Figma auto-layout items keep their size; CSS flex items shrink to fit by
  // default. Lock the main-axis size unless it's FILL, so a fixed-height (or
  // fixed-width) parent can't squish content, e.g. an image band collapsing.
  const mainSize = hParent ? hSize : vSize;
  if (mainSize !== "FILL") rule["flex-shrink"] = 0;
}

export function applyLayout(node: SceneNode, rule: Rule) {
  if (!("layoutMode" in node) || node.layoutMode === "NONE") return;
  const n = node as FrameNode;
  rule.display = "flex";
  rule["flex-direction"] = n.layoutMode === "VERTICAL" ? "column" : "row";

  const pad = [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft];
  if (pad.some((p) => p > 0))
    rule.padding = pad.map((p) => `${Math.round(p)}px`).join(" ");

  const primary: { [k: string]: string } = {
    MIN: "flex-start",
    CENTER: "center",
    MAX: "flex-end",
    SPACE_BETWEEN: "space-between",
  };
  const counter: { [k: string]: string } = {
    MIN: "flex-start",
    CENTER: "center",
    MAX: "flex-end",
    BASELINE: "baseline",
  };
  rule["justify-content"] = primary[n.primaryAxisAlignItems] || "flex-start";
  rule["align-items"] = counter[n.counterAxisAlignItems] || "flex-start";

  if (n.primaryAxisAlignItems !== "SPACE_BETWEEN" && n.itemSpacing > 0)
    rule.gap = `${Math.round(n.itemSpacing)}px`;
}
