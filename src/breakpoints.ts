// Mobile-first responsive breakpoints. The five standard Tailwind v4 tokens are
// min-width based; the smallest selected frame is the unprefixed base.

export type Token = "base" | "sm" | "md" | "lg" | "xl" | "2xl";

export interface Assigned {
  index: number; // position in the caller's original widths array
  token: Token;
  minWidth: number;
}

// Ascending, matching Tailwind v4 defaults (px). Base (0) is implicit.
export const STANDARD: { token: Token; minWidth: number }[] = [
  { token: "sm", minWidth: 640 },
  { token: "md", minWidth: 768 },
  { token: "lg", minWidth: 1024 },
  { token: "xl", minWidth: 1280 },
  { token: "2xl", minWidth: 1536 },
];

// Sort frames by width; the smallest is base. Each larger frame takes the
// largest standard token at or below its width that is still above the previous
// frame's token, so tokens strictly increase and never collide. If a frame is
// narrower than the next token above prev, it still advances to that next token
// to preserve order.
export function assignBreakpoints(widths: number[]): Assigned[] {
  const order = widths
    .map((width, index) => ({ width, index }))
    .sort((a, b) => a.width - b.width);

  const out: Assigned[] = [];
  let prevMin = -1; // base sits at 0; -1 lets the first frame take base
  for (let i = 0; i < order.length; i++) {
    const { width, index } = order[i];
    if (i === 0) {
      out.push({ index, token: "base", minWidth: 0 });
      prevMin = 0;
      continue;
    }
    // Largest standard token whose min-width is <= width and > prevMin.
    let pick = STANDARD.filter((s) => s.minWidth <= width && s.minWidth > prevMin).pop();
    // None fits below width: advance to the smallest token above prevMin.
    if (!pick) pick = STANDARD.find((s) => s.minWidth > prevMin);
    if (!pick) throw new Error("Too many frames for one responsive set (max 6).");
    out.push({ index, token: pick.token, minWidth: pick.minWidth });
    prevMin = pick.minWidth;
  }
  return out;
}
