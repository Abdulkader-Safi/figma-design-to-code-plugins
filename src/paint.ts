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
import { rgba, round, gradientPaintCss } from "./values";

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

// A resolved image: its CSS url() and its natural pixel size, which a tiling
// paint needs in order to repeat at the right scale.
export interface ResolvedImage {
  ref: string;
  width: number;
  height: number;
}

// Returns null when the image is missing or cannot be decoded, so the layer is
// dropped rather than emitting a broken url().
export type ImageResolver = (paint: ImagePaint) => Promise<ResolvedImage | null>;

// One image file in the exported bundle.
export interface Asset {
  path: string; // relative to the document, e.g. "images/img-0.png"
  bytes: Uint8Array;
}

export interface ImageStore {
  resolve: ImageResolver; // paint -> its file reference and natural size
  addBytes(bytes: Uint8Array): string; // already-rendered PNG -> its path
  assets(): Asset[];
  bytes(): number;
}

export interface ImageStoreOpts {
  onProgress?: (done: number, bytes: number) => void;
}

// Images are written as separate files, not inlined.
//
// Base64 in the document was the wrong shape twice over: it costs a third more
// than the bytes it carries, and a source asset here decoded to ~40 MB of text
// on its own, which is more than a browser or the plugin panel will handle. A
// bundle of real files is also what anyone actually wants to hand to a build.
//
// Each distinct image is fetched once however many nodes paint with it; in one
// real page a single hero texture was painted by six.
export function createImageStore(opts: ImageStoreOpts = {}): ImageStore {
  const byHash = new Map<string, ResolvedImage | null>();
  const files: Asset[] = [];
  let total = 0;

  const store = (bytes: Uint8Array): string => {
    const path = `images/img-${files.length}.png`;
    files.push({ path, bytes });
    total += bytes.length;
    return path;
  };

  const resolve: ImageResolver = async (paint) => {
    const hash = paint.imageHash;
    if (!hash) return null;
    const seen = byHash.get(hash);
    if (seen !== undefined) return seen;

    let out: ResolvedImage | null = null;
    try {
      const img = figma.getImageByHash(hash);
      if (img) {
        // Natural size is what a tiling paint repeats at, so it travels with the
        // reference rather than being guessed from the node's box.
        const size = await img.getSizeAsync();
        out = {
          ref: `url("${store(await img.getBytesAsync())}")`,
          width: size.width,
          height: size.height,
        };
      }
    } catch {
      out = null;
    }
    byHash.set(hash, out);
    opts.onProgress?.(files.length, total);
    return out;
  };

  return {
    resolve,
    addBytes: (bytes) => {
      const path = store(bytes);
      opts.onProgress?.(files.length, total);
      return path;
    },
    assets: () => files,
    bytes: () => total,
  };
}

// How an image paint sits in its box. CROP is driven by imageTransform, which
// the API docs do not pin down; cover is the closest safe default.
function imageSizing(paint: ImagePaint, img: ResolvedImage): Rule {
  switch (paint.scaleMode) {
    case "FIT":
      return {
        "background-size": "contain",
        "background-repeat": "no-repeat",
        "background-position": "center",
      };
    case "TILE": {
      // A tile repeats at its own size, scaled by scalingFactor. Percentages are
      // relative to the BOX, so `background-size: 100%` stretches one copy
      // across the whole element instead of repeating a small pattern.
      const f = paint.scalingFactor ?? 1;
      const w = Math.max(1, Math.round(img.width * f));
      const h = Math.max(1, Math.round(img.height * f));
      return { "background-size": `${w}px ${h}px`, "background-repeat": "repeat" };
    }
    default:
      return {
        "background-size": "cover",
        "background-repeat": "no-repeat",
        "background-position": "center",
      };
  }
}

// Figma's per-image adjustments. Only three have a CSS analogue; temperature,
// tint, highlights and shadows do not, and are left alone rather than faked.
// Ranges run -1..1 around a neutral 0, so each maps to a 1 + value multiplier.
function imageFilter(paint: ImagePaint): string | null {
  const f = paint.filters;
  if (!f) return null;
  const parts: string[] = [];
  if (f.saturation) parts.push(`saturate(${round(1 + f.saturation)})`);
  if (f.contrast) parts.push(`contrast(${round(1 + f.contrast)})`);
  if (f.exposure) parts.push(`brightness(${round(1 + f.exposure)})`);
  return parts.length ? parts.join(" ") : null;
}

// The CSS image value for one paint, with its opacity folded in where that is
// exact (solids and gradients carry alpha per stop). Null when the paint has no
// CSS form.
async function paintImage(
  p: Paint,
  resolve: ImageResolver,
): Promise<{ image: string; resolved?: ResolvedImage } | null> {
  const o = p.opacity ?? 1;
  if (p.type === "SOLID") {
    const c = rgba(p.color, o);
    // A two-stop gradient, not background-color: only an image value can take
    // part in a layer list, and background-color always paints underneath.
    return { image: `linear-gradient(${c}, ${c})` };
  }
  if (
    p.type === "GRADIENT_LINEAR" ||
    p.type === "GRADIENT_RADIAL" ||
    p.type === "GRADIENT_ANGULAR" ||
    p.type === "GRADIENT_DIAMOND"
  ) {
    return { image: gradientPaintCss(p, o) };
  }
  if (p.type === "IMAGE") {
    const r = await resolve(p);
    return r ? { image: r.ref, resolved: r } : null;
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
  backdrop?: string | null,
): Promise<FillResult> {
  const paints = visiblePaints(fills);
  if (paints.length === 0) return { rule: {}, layers: [] };

  // The overwhelmingly common case: one plain paint, straight onto background.
  if (paints.length === 1 && !needsOwnLayer(paints[0])) {
    const only = paints[0];
    if (only.type === "SOLID") return { rule: { background: rgba(only.color, only.opacity ?? 1) }, layers: [] };
    const img = await paintImage(only, resolve);
    if (!img) return { rule: {}, layers: [] };
    const rule: Rule = { background: img.image };
    if (only.type === "IMAGE" && img.resolved) {
      Object.assign(rule, imageSizing(only, img.resolved));
      const filter = imageFilter(only);
      if (filter) rule.filter = filter;
    }
    return { rule, layers: [] };
  }

  const layers: FillLayer[] = [];

  // What the bottom paint blends against. In Figma that is whatever sits behind
  // the node; here the node isolates, so without this the backdrop is
  // transparent and a blend mode has nothing to work on. An OVERLAY image over a
  // near-black page reads dark, and over nothing it stays at full brightness --
  // which is exactly how a dark textured band came out as a bright gradient.
  if (backdrop && paints.some((p) => needsOwnLayer(p))) {
    layers.push({
      className: `${className}-fillbase`,
      rule: {
        position: "absolute",
        inset: "0",
        "border-radius": "inherit",
        "pointer-events": "none",
        "z-index": "-1",
        background: backdrop,
      },
    });
  }

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
      background: img.image,
    };
    if (p.type === "IMAGE" && img.resolved) {
      Object.assign(rule, imageSizing(p, img.resolved));
      const o = p.opacity ?? 1;
      if (o < 1) rule.opacity = String(Math.round(o * 100) / 100);
      // Figma's per-image adjustments, e.g. a fully desaturated texture that
      // reads grey in the design and shipped at full colour without this.
      const filter = imageFilter(p);
      if (filter) rule.filter = filter;
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
