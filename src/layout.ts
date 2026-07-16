// Position, size, and flexbox: maps Figma auto-layout to flexbox and static
// frames to absolute positioning.

import type { Rule } from "./types";

export function positionAndSize(
  node: SceneNode,
  parent: SceneNode | null,
  absolute: boolean,
  rule: Rule,
) {
  const w = "width" in node ? Math.round(node.width) : undefined;
  const h = "height" in node ? Math.round(node.height) : undefined;

  if (parent === null) {
    rule.position = "relative";
    rule.margin = "0 auto";
    if (w !== undefined) rule.width = `${w}px`;
    if (h !== undefined) rule.height = `${h}px`;
    return;
  }

  if (absolute) {
    rule.position = "absolute";
    rule.left = `${Math.round(node.x)}px`;
    rule.top = `${Math.round(node.y)}px`;
    if (w !== undefined) rule.width = `${w}px`;
    if (h !== undefined) rule.height = `${h}px`;
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
