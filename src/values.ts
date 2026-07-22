// Value converters: Figma paints and numbers -> CSS strings, plus small
// string helpers shared across the generator.

export const round = (n: number): number => Math.round(n * 100) / 100;

export function solidFill(
  fills: readonly Paint[] | typeof figma.mixed,
): string | null {
  if (!Array.isArray(fills)) return null;
  const f = fills.find((x) => x.visible !== false && x.type === "SOLID") as
    SolidPaint | undefined;
  return f ? rgba(f.color, f.opacity) : null;
}

// Any gradient paint -> a CSS gradient. Linear reads its real angle from
// gradientTransform; radial and angular (conic) render with all their stops and
// a best-effort center; diamond falls back to radial (CSS has no diamond form).
export function gradientFill(
  fills: readonly Paint[] | typeof figma.mixed,
): string | null {
  if (!Array.isArray(fills)) return null;
  const g = fills.find(
    (x) =>
      x.visible !== false &&
      (x.type === "GRADIENT_LINEAR" ||
        x.type === "GRADIENT_RADIAL" ||
        x.type === "GRADIENT_ANGULAR" ||
        x.type === "GRADIENT_DIAMOND"),
  ) as GradientPaint | undefined;
  return g ? gradientPaintCss(g, g.opacity ?? 1) : null;
}

// One gradient paint -> a CSS gradient. `alpha` is the paint's own opacity,
// which multiplies each stop's alpha: Figma keeps the two separate, and a stop
// that is already translucent must not be reset to the paint's value.
export function gradientPaintCss(g: GradientPaint, alpha = 1): string {
  // Stops as "color pos%", shared by every gradient kind (conic accepts the
  // percentage form too, as a fraction of the turn).
  const stops = g.gradientStops
    .map((s) => `${rgba(s.color, (s.color.a ?? 1) * alpha)} ${Math.round(s.position * 100)}%`)
    .join(", ");

  const t = g.gradientTransform; // [[a, b, tx], [c, d, ty]]
  if (g.type === "GRADIENT_LINEAR")
    return `linear-gradient(${gradientAngle(t)}deg, ${stops})`;
  if (g.type === "GRADIENT_ANGULAR")
    return `conic-gradient(from ${gradientRotation(t)}deg at ${gradientCenter(t)}, ${stops})`;
  // ponytail: diamond falls back to radial (CSS has no diamond gradient).
  return `radial-gradient(${gradientCenter(t)}, ${stops})`;
}

// CSS angle (deg, in [0,360)) from a linear gradientTransform. The transform
// maps object-normalized coords to gradient space, so the gradient position
// increases along object-space direction (a, b) with y pointing down. CSS 0deg
// points up and turns clockwise (direction (sinθ, -cosθ)), giving atan2(a, -b).
function gradientAngle(t: Transform): number {
  const deg = (Math.atan2(t[0][0], -t[0][1]) * 180) / Math.PI;
  return ((Math.round(deg) % 360) + 360) % 360;
}

// Conic start angle: the rotation of the transform's linear part.
function gradientRotation(t: Transform): number {
  const deg = (Math.atan2(t[1][0], t[0][0]) * 180) / Math.PI;
  return ((Math.round(deg) % 360) + 360) % 360;
}

// Gradient center as "cx% cy%", from the inverse of the transform's 2x2 linear
// part applied to the gradient-space center (0.5, 0.5). Falls back to "50% 50%"
// when the matrix is degenerate; out-of-range centers are kept (CSS allows them).
function gradientCenter(t: Transform): string {
  const [a, b, tx] = t[0];
  const [c, d, ty] = t[1];
  const det = a * d - b * c;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-6) return "50% 50%";
  const px = 0.5 - tx;
  const py = 0.5 - ty;
  const cx = (d * px - b * py) / det;
  const cy = (-c * px + a * py) / det;
  return `${round(cx * 100)}% ${round(cy * 100)}%`;
}

export function rgba(c: RGB | RGBA, opacity?: number): string {
  const a = opacity !== undefined ? opacity : "a" in c ? (c as RGBA).a : 1;
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  if (a >= 1) {
    const hex = (n: number) => n.toString(16).padStart(2, "0");
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }
  return `rgba(${r}, ${g}, ${b}, ${round(a)})`;
}

export function styleToWeight(style: string): number {
  const s = style.toLowerCase();
  if (s.includes("thin")) return 100;
  if (s.includes("extra light") || s.includes("ultra light")) return 200;
  if (s.includes("semi bold") || s.includes("demi bold")) return 600;
  if (s.includes("extra bold") || s.includes("ultra bold")) return 800;
  if (s.includes("black") || s.includes("heavy")) return 900;
  if (s.includes("medium")) return 500;
  if (s.includes("light")) return 300;
  if (s.includes("bold")) return 700;
  return 400;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function sanitizeFileName(name: string): string {
  return (
    (name || "export")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "export"
  );
}
