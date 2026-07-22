// Figma's fill stack -> CSS. A node can carry any number of paints, each with
// its own opacity and blend mode, and the result is what the designer sees. The
// exporter used to read a single fill and, if any fill was an image, replace the
// whole node with an <img> -- which silently deleted every child. Both are fixed
// here.
//
// Two shapes come out. A plain single paint stays a plain `background`, so the
// common case reads the way a developer would write it. Anything layered becomes
// one absolutely positioned overlay per paint, because CSS has no per-layer
// opacity: `background-image` accepts a list, but you cannot fade one entry of
// it. Overlay elements can carry their own opacity and mix-blend-mode, so the
// stack comes out exact.

import type { Rule } from "./types";
import { rgba, gradientPaintCss } from "./values";

// Figma BlendMode -> CSS. PASS_THROUGH is not a blend mode (it means "do not
// isolate"), and the two Plus modes have no cross-browser equivalent, so all
// three fall back to normal rather than shipping something wrong.
const BLEND: { [k: string]: string } = {
  NORMAL: "normal",
  DARKEN: "darken",
  MULTIPLY: "multiply",
  COLOR_BURN: "color-burn",
  LIGHTEN: "lighten",
  SCREEN: "screen",
  COLOR_DODGE: "color-dodge",
  OVERLAY: "overlay",
  SOFT_LIGHT: "soft-light",
  HARD_LIGHT: "hard-light",
  DIFFERENCE: "difference",
  EXCLUSION: "exclusion",
  HUE: "hue",
  SATURATION: "saturation",
  COLOR: "color",
  LUMINOSITY: "luminosity",
};

export const blendCss = (mode: string | undefined): string =>
  BLEND[mode ?? "NORMAL"] ?? "normal";

const visiblePaints = (fills: readonly Paint[] | typeof figma.mixed): Paint[] =>
  Array.isArray(fills) ? fills.filter((p) => p.visible !== false) : [];

// A paint is layered when it needs more than a flat `background` can express.
const needsOwnLayer = (p: Paint): boolean =>
  blendCss(p.blendMode) !== "normal" || (p.type === "IMAGE" && (p.opacity ?? 1) < 1);

// PNG bytes for an image paint, as a data URI. Returns null when the image is
// missing or the host cannot decode it, so the layer is dropped rather than
// emitting a broken url().
export type ImageResolver = (paint: ImagePaint) => Promise<string | null>;

export const imageResolver: ImageResolver = async (paint) => {
  if (!paint.imageHash) return null;
  try {
    const img = figma.getImageByHash(paint.imageHash);
    if (!img) return null;
    const bytes = await img.getBytesAsync();
    return `data:image/png;base64,${figma.base64Encode(bytes)}`;
  } catch {
    return null;
  }
};

// How an image paint sits in its box. CROP is driven by imageTransform, which
// the API docs do not pin down; cover is the closest safe default.
function imageSizing(paint: ImagePaint): Rule {
  switch (paint.scaleMode) {
    case "FIT":
      return { "background-size": "contain", "background-repeat": "no-repeat", "background-position": "center" };
    case "TILE": {
      const f = paint.scalingFactor ?? 1;
      return { "background-size": `${Math.round(f * 100)}%`, "background-repeat": "repeat" };
    }
    default:
      return { "background-size": "cover", "background-repeat": "no-repeat", "background-position": "center" };
  }
}

// The CSS image value for one paint, with its opacity folded in where that is
// exact (solids and gradients carry alpha per stop). Null when the paint has no
// CSS form.
async function paintImage(p: Paint, resolve: ImageResolver): Promise<string | null> {
  const o = p.opacity ?? 1;
  if (p.type === "SOLID") {
    const c = rgba(p.color, o);
    // A two-stop gradient, not background-color: only an image value can take
    // part in a layer list, and background-color always paints underneath.
    return `linear-gradient(${c}, ${c})`;
  }
  if (
    p.type === "GRADIENT_LINEAR" ||
    p.type === "GRADIENT_RADIAL" ||
    p.type === "GRADIENT_ANGULAR" ||
    p.type === "GRADIENT_DIAMOND"
  ) {
    return gradientPaintCss(p, o);
  }
  if (p.type === "IMAGE") {
    const url = await resolve(p);
    return url ? `url("${url}")` : null;
  }
  return null; // VIDEO, PATTERN, SHADER: no CSS form, and rasterising is the caller's job
}

// One overlay element standing in for one paint.
export interface FillLayer {
  className: string;
  rule: Rule;
}

export interface FillResult {
  // Applied to the node itself.
  rule: Rule;
  // Emitted as absolutely positioned children, in paint order (first is bottom).
  layers: FillLayer[];
}

// The whole fill stack for a node.
//
// Figma's fills array runs bottom-to-top, and so do the overlay elements: a
// later sibling paints over an earlier one, which is the same order. That is the
// opposite of a CSS `background-image` list, where the FIRST entry is on top --
// the trap this function exists to avoid.
export async function fillStack(
  fills: readonly Paint[] | typeof figma.mixed,
  className: string,
  resolve: ImageResolver,
): Promise<FillResult> {
  const paints = visiblePaints(fills);
  if (paints.length === 0) return { rule: {}, layers: [] };

  // The overwhelmingly common case: one plain paint, straight onto background.
  if (paints.length === 1 && !needsOwnLayer(paints[0])) {
    const only = paints[0];
    if (only.type === "SOLID") return { rule: { background: rgba(only.color, only.opacity ?? 1) }, layers: [] };
    const img = await paintImage(only, resolve);
    if (!img) return { rule: {}, layers: [] };
    const rule: Rule = { background: img };
    if (only.type === "IMAGE") Object.assign(rule, imageSizing(only));
    return { rule, layers: [] };
  }

  const layers: FillLayer[] = [];
  for (let i = 0; i < paints.length; i++) {
    const p = paints[i];
    const img = await paintImage(p, resolve);
    if (!img) continue;
    const rule: Rule = {
      position: "absolute",
      inset: "0",
      "border-radius": "inherit",
      "pointer-events": "none",
      // Behind the node's own content but above its background, because the node
      // isolates. Without isolation these would slide behind the background too.
      "z-index": "-1",
      background: img,
    };
    if (p.type === "IMAGE") {
      Object.assign(rule, imageSizing(p));
      const o = p.opacity ?? 1;
      if (o < 1) rule.opacity = String(Math.round(o * 100) / 100);
    }
    const blend = blendCss(p.blendMode);
    if (blend !== "normal") rule["mix-blend-mode"] = blend;
    layers.push({ className: `${className}-fill${i}`, rule });
  }

  if (layers.length === 0) return { rule: {}, layers: [] };
  // isolate does two jobs: it keeps mix-blend-mode inside this node instead of
  // letting it blend with the whole page, and it gives the z-index:-1 layers a
  // stacking context to sit in.
  return { rule: { position: "relative", isolation: "isolate" }, layers };
}
