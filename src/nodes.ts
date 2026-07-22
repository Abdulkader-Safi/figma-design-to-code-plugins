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

const visibleKids = (n: SceneNode): number =>
  "children" in n ? n.children.filter((c) => !("visible" in c) || c.visible !== false).length : 0;

// An image fill only becomes an <img> when the node is a leaf. On a container it
// is a background, and swapping the container for an <img> deletes everything
// inside it: whole hero sections and every overlay heading were being replaced
// by a flat picture of themselves.
export const isImageLeaf = (n: SceneNode): boolean =>
  hasImageFill(n) && visibleKids(n) === 0;

// A container is an icon/illustration when its whole subtree is vector art:
// at least one real vector, and no text or image anywhere. Such nodes export
// cleanly as a single SVG; anything with text (a card, a button) does not.
//
// There used to be a 128px size cap here, on the assumption that only icons are
// worth flattening. A hero's generative wave broke that: 1686 vector paths, each
// exported as its own positioned div with its own inline SVG, which came to
// 840 KB of markup and did not look like the design. Size is not the signal.
// Vector art is vector art at any scale, so the whole subtree goes out as one
// SVG and Figma composes it exactly as drawn.
export function isIconContainer(node: SceneNode): boolean {
  if (!("children" in node) || node.children.length === 0) return false;
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
