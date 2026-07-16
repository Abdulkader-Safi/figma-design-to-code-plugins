// Box decoration: background, corner radius, borders (incl. per-side), shadows,
// and clipping.

import type { Rule } from "./types";
import { solidFill, linearGradient, rgba } from "./values";

export function applyBoxDecoration(node: SceneNode, rule: Rule) {
  // Clip children to rounded corners for any frame Figma clips, auto-layout or
  // not, so a bottom child can't poke square corners past a rounded parent.
  if ("clipsContent" in node && node.clipsContent) rule.overflow = "hidden";

  // Background.
  if ("fills" in node && Array.isArray(node.fills)) {
    const bg = solidFill(node.fills) || linearGradient(node.fills);
    if (bg) rule.background = bg;
  }

  // Corner radius.
  if (node.type === "ELLIPSE") {
    rule["border-radius"] = "50%";
  } else if ("cornerRadius" in node) {
    const cr = node.cornerRadius;
    if (typeof cr === "number" && cr > 0)
      rule["border-radius"] = `${Math.round(cr)}px`;
    else if (cr === figma.mixed && "topLeftRadius" in node) {
      const c = node as RectangleNode;
      rule["border-radius"] =
        `${c.topLeftRadius}px ${c.topRightRadius}px ${c.bottomRightRadius}px ${c.bottomLeftRadius}px`;
    }
  }

  // Border.
  if ("strokes" in node && Array.isArray(node.strokes)) {
    const s = node.strokes.find(
      (x) => x.visible !== false && x.type === "SOLID",
    ) as SolidPaint | undefined;
    if (s) {
      const color = rgba(s.color, s.opacity);
      if ("strokeTopWeight" in node) {
        // Figma allows per-side stroke weights; honour each side so a bottom-only
        // rule doesn't become a full box.
        const t = Math.round(node.strokeTopWeight);
        const r = Math.round(node.strokeRightWeight);
        const b = Math.round(node.strokeBottomWeight);
        const l = Math.round(node.strokeLeftWeight);
        if (t === r && r === b && b === l) {
          if (t > 0) rule.border = `${t}px solid ${color}`;
        } else {
          if (t > 0) rule["border-top"] = `${t}px solid ${color}`;
          if (r > 0) rule["border-right"] = `${r}px solid ${color}`;
          if (b > 0) rule["border-bottom"] = `${b}px solid ${color}`;
          if (l > 0) rule["border-left"] = `${l}px solid ${color}`;
        }
      } else {
        const w = typeof node.strokeWeight === "number" ? node.strokeWeight : 1;
        if (w > 0) rule.border = `${w}px solid ${color}`;
      }
    }
  }

  // Shadows.
  if ("effects" in node && Array.isArray(node.effects)) {
    const shadows = node.effects
      .filter(
        (e) =>
          e.visible !== false &&
          (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW"),
      )
      .map((e) => {
        const inset = e.type === "INNER_SHADOW" ? "inset " : "";
        const s = e as DropShadowEffect;
        return `${inset}${Math.round(s.offset.x)}px ${Math.round(s.offset.y)}px ${Math.round(s.radius)}px ${Math.round(s.spread || 0)}px ${rgba(s.color, s.color.a)}`;
      });
    if (shadows.length) rule["box-shadow"] = shadows.join(", ");
  }
}
