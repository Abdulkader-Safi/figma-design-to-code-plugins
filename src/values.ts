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

export function linearGradient(
  fills: readonly Paint[] | typeof figma.mixed,
): string | null {
  if (!Array.isArray(fills)) return null;
  const g = fills.find(
    (x) => x.visible !== false && x.type === "GRADIENT_LINEAR",
  ) as GradientPaint | undefined;
  if (!g) return null;
  const stops = g.gradientStops
    .map((s) => `${rgba(s.color, s.color.a)} ${Math.round(s.position * 100)}%`)
    .join(", ");
  return `linear-gradient(180deg, ${stops})`; // ponytail: fixed 180deg; read gradientTransform for exact angle if needed
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
