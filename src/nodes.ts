// Node-shape predicates: what a node IS, used to pick how it's exported.

export const isAutoLayout = (n: SceneNode): boolean =>
  "layoutMode" in n && n.layoutMode !== "NONE";

// Figma's "Ignore auto layout" toggle. The child drops out of its parent's flow
// and keeps its own x/y, which is exactly CSS position: absolute.
export const ignoresAutoLayout = (n: SceneNode): boolean =>
  "layoutPositioning" in n && n.layoutPositioning === "ABSOLUTE";

// Figma's ellipse carries "arc" handles: sweep it short of a full turn and it
// becomes a pie slice, give it an inner radius and it becomes a ring. Neither is
// a CSS box, so a solid border-radius: 50% div paints a filled disc over
// whatever the ring was meant to frame. Those go out as SVG instead. A plain
// full ellipse stays a rounded div and keeps its fills and image fills.
const TURN = Math.PI * 2;
export const isArcEllipse = (n: SceneNode): boolean =>
  n.type === "ELLIPSE" &&
  (n.arcData.innerRadius > 0 ||
    Math.abs(n.arcData.endingAngle - n.arcData.startingAngle) < TURN - 1e-6);

export const isVectorLike = (n: SceneNode): boolean =>
  n.type === "VECTOR" ||
  n.type === "BOOLEAN_OPERATION" ||
  n.type === "STAR" ||
  n.type === "LINE" ||
  n.type === "POLYGON" ||
  isArcEllipse(n);

// A text node on Figma's "Auto width": its box is measured from the glyphs, so
// it is exact-fit and single-line by construction. "Auto height" and the fixed
// sizes are left alone, since their wrapping is the design's intent.
export const hugsText = (n: SceneNode): boolean =>
  n.type === "TEXT" && n.textAutoResize === "WIDTH_AND_HEIGHT";

export const hasImageFill = (n: SceneNode): boolean =>
  "fills" in n &&
  Array.isArray(n.fills) &&
  n.fills.some((f) => f.visible !== false && f.type === "IMAGE");

// A container is an icon/illustration when its whole subtree is vector art:
// at least one real vector, and no text or image anywhere. Such nodes export
// cleanly as a single SVG; anything with text (a card, a button) does not.
export function isIconContainer(node: SceneNode): boolean {
  if (!("children" in node) || node.children.length === 0) return false;
  // Icons are small; cap the size so real sections or large vector art aren't
  // flattened into one SVG. ponytail: raise the cap if big vector logos need it.
  if ("width" in node && (node.width > 128 || node.height > 128)) return false;
  let hasVector = false;
  let ok = true;
  const walk = (n: SceneNode) => {
    if (!ok) return;
    if (n.type === "TEXT" || hasImageFill(n)) {
      ok = false;
      return;
    }
    if (isVectorLike(n)) hasVector = true;
    if ("children" in n) n.children.forEach(walk);
  };
  node.children.forEach(walk);
  return ok && hasVector;
}
