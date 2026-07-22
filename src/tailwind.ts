// CSS rule object -> Tailwind v4 utility classes. Prefers real utilities
// (font-semibold, pt-4, rounded-lg, italic, a themed font-*) over the
// [property:value] escape hatch. Exact design values that Tailwind can only
// express with a bracket (an off-scale size, a hex colour, a line-height ratio)
// keep the arbitrary form text-[16px] / bg-[#0a0f14] — that IS idiomatic
// Tailwind, per the docs, not "CSS in Tailwind".

import type { Rule } from "./types";

export function toTailwind(rule: Rule): string {
  return Object.keys(rule)
    .map((k) => twUtil(k, String(rule[k])))
    .filter(Boolean)
    .join(" ");
}

// A family value like "'Space Grotesk', sans-serif" -> "space-grotesk", the
// slug shared by the @theme --font-* key and the font-* utility.
export function fontSlug(fontFamily: string): string {
  const first = fontFamily.split(",")[0].replace(/['"]/g, "").trim();
  return (
    first
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "sans"
  );
}

// Tailwind's spacing scale is 0.25rem (4px) per step, so a px value on the 4px
// grid maps to a plain token (p-4); anything else keeps an arbitrary px value.
// Zero collapses away — the default.
function scaleUtil(prefix: string, px: number): string {
  if (px === 0) return "";
  if (px > 0 && Number.isInteger(px / 4)) return `${prefix}-${px / 4}`;
  return `${prefix}-[${px}px]`;
}

// A 1-to-4 value box shorthand (padding/margin) -> per-side scale utilities,
// collapsed to p-/px-/py- where sides match, zero sides dropped.
function boxSpacing(prefix: string, v: string): string {
  const parts = v.split(/\s+/).map((s) => parseFloat(s));
  if (parts.some((n) => Number.isNaN(n)))
    return `${prefix}-[${v.replace(/\s+/g, "_")}]`;
  let t: number, r: number, b: number, l: number;
  if (parts.length === 1)
    [t, r, b, l] = [parts[0], parts[0], parts[0], parts[0]];
  else if (parts.length === 2)
    [t, r, b, l] = [parts[0], parts[1], parts[0], parts[1]];
  else if (parts.length === 3)
    [t, r, b, l] = [parts[0], parts[1], parts[2], parts[1]];
  else [t, r, b, l] = [parts[0], parts[1], parts[2], parts[3]];

  if (t === r && r === b && b === l)
    return scaleUtil(prefix, t) || `${prefix}-0`;

  const out: string[] = [];
  if (l === r) {
    const u = scaleUtil(`${prefix}x`, l);
    if (u) out.push(u);
  } else {
    const ul = scaleUtil(`${prefix}l`, l);
    const ur = scaleUtil(`${prefix}r`, r);
    if (ul) out.push(ul);
    if (ur) out.push(ur);
  }
  if (t === b) {
    const u = scaleUtil(`${prefix}y`, t);
    if (u) out.push(u);
  } else {
    const ut = scaleUtil(`${prefix}t`, t);
    const ub = scaleUtil(`${prefix}b`, b);
    if (ut) out.push(ut);
    if (ub) out.push(ub);
  }
  return out.join(" ") || `${prefix}-0`;
}

const WEIGHTS: { [k: string]: string } = {
  "100": "font-thin",
  "200": "font-extralight",
  "300": "font-light",
  "400": "font-normal",
  "500": "font-medium",
  "600": "font-semibold",
  "700": "font-bold",
  "800": "font-extrabold",
  "900": "font-black",
};

// Tailwind's default border-radius scale (px) -> token.
const RADIUS: { [k: string]: string } = {
  "2": "rounded-sm",
  "4": "rounded",
  "6": "rounded-md",
  "8": "rounded-lg",
  "12": "rounded-xl",
  "16": "rounded-2xl",
  "24": "rounded-3xl",
};

function radiusUtil(v: string): string {
  if (v === "50%") return "rounded-full";
  const parts = v.split(/\s+/);
  if (parts.length === 1) {
    const px = parseFloat(v);
    if (!Number.isNaN(px)) return RADIUS[String(px)] || `rounded-[${px}px]`;
  }
  return `rounded-[${v.replace(/\s+/g, "_")}]`;
}

// "Npx solid #color" on one side ("" = all) -> border[-side][-width] plus a
// matching colour utility, e.g. border border-[#fff] or border-t-2 border-t-[#fff].
function borderUtil(side: string, v: string): string {
  const m = v.match(/^(\d+)px\s+\w+\s+(.+)$/);
  const base = side ? `border-${side}` : "border";
  if (!m) return `[border${side ? "-" + side : ""}:${v.replace(/\s+/g, "_")}]`;
  const w = m[1];
  const color = m[2];
  const width =
    w === "1"
      ? base
      : ["2", "4", "8"].includes(w)
        ? `${base}-${w}`
        : `${base}-[${w}px]`;
  return `${width} ${base}-[${color}]`;
}

function twUtil(k: string, v: string): string {
  const a = v.replace(/\s+/g, "_"); // arbitrary-value form
  const pick = (m: { [key: string]: string }, prop: string) =>
    m[v] || `[${prop}:${a}]`;
  switch (k) {
    case "display":
      return pick(
        {
          flex: "flex",
          block: "block",
          "inline-block": "inline-block",
          none: "hidden",
          grid: "grid",
        },
        k,
      );
    case "position":
      return ["static", "relative", "absolute", "fixed", "sticky"].includes(v)
        ? v
        : `[${k}:${a}]`;
    case "flex-direction":
      return v === "column"
        ? "flex-col"
        : v === "row"
          ? "flex-row"
          : `[${k}:${a}]`;
    case "justify-content":
      return pick(
        {
          "flex-start": "justify-start",
          center: "justify-center",
          "flex-end": "justify-end",
          "space-between": "justify-between",
          "space-around": "justify-around",
          "space-evenly": "justify-evenly",
        },
        k,
      );
    case "align-items":
      return pick(
        {
          "flex-start": "items-start",
          center: "items-center",
          "flex-end": "items-end",
          baseline: "items-baseline",
          stretch: "items-stretch",
        },
        k,
      );
    case "align-self":
      return pick(
        {
          stretch: "self-stretch",
          center: "self-center",
          "flex-start": "self-start",
          "flex-end": "self-end",
          auto: "self-auto",
          baseline: "self-baseline",
        },
        k,
      );
    case "flex":
      return v === "1 1 0" || v === "1" ? "flex-1" : `flex-[${a}]`;
    case "flex-shrink":
      return v === "0" ? "shrink-0" : `shrink-[${v}]`;
    case "overflow":
      return pick(
        {
          hidden: "overflow-hidden",
          auto: "overflow-auto",
          scroll: "overflow-scroll",
          visible: "overflow-visible",
        },
        k,
      );
    case "text-align":
      return pick(
        {
          left: "text-left",
          center: "text-center",
          right: "text-right",
          justify: "text-justify",
        },
        k,
      );
    case "text-decoration":
      return pick(
        {
          underline: "underline",
          "line-through": "line-through",
          none: "no-underline",
        },
        k,
      );
    case "text-transform":
      return pick(
        {
          uppercase: "uppercase",
          lowercase: "lowercase",
          capitalize: "capitalize",
          none: "normal-case",
        },
        k,
      );
    case "font-style":
      return v === "italic"
        ? "italic"
        : v === "normal"
          ? "not-italic"
          : `[font-style:${a}]`;
    case "font-weight":
      return WEIGHTS[v] || `font-[${v}]`;
    case "font-family":
      return `font-${fontSlug(v)}`;
    case "object-fit":
      return pick(
        {
          cover: "object-cover",
          contain: "object-contain",
          fill: "object-fill",
          none: "object-none",
        },
        k,
      );
    case "width":
      return v === "100%"
        ? "w-full"
        : v === "fit-content"
          ? "w-fit"
          : v === "auto"
            ? "w-auto"
            : `w-[${a}]`;
    case "height":
      return v === "100%"
        ? "h-full"
        : v === "fit-content"
          ? "h-fit"
          : v === "auto"
            ? "h-auto"
            : `h-[${a}]`;
    case "white-space":
      return v === "nowrap" ? "whitespace-nowrap" : `[white-space:${a}]`;
    case "max-width":
      return v === "100%" ? "max-w-full" : `max-w-[${a}]`;
    case "min-width":
      return parseFloat(v) === 0 ? "min-w-0" : `min-w-[${a}]`;
    case "min-height":
      return parseFloat(v) === 0 ? "min-h-0" : `min-h-[${a}]`;
    case "gap": {
      const px = parseFloat(v);
      return Number.isNaN(px) ? `gap-[${a}]` : scaleUtil("gap", px) || "gap-0";
    }
    case "padding":
      return boxSpacing("p", v);
    case "margin":
      return v === "0 auto" ? "mx-auto" : boxSpacing("m", v);
    case "left":
    case "top":
    case "right":
    case "bottom": {
      const px = parseFloat(v);
      if (Number.isNaN(px)) return `${k}-[${a}]`;
      if (px === 0) return `${k}-0`;
      return Number.isInteger(px / 4) && px > 0
        ? `${k}-${px / 4}`
        : `${k}-[${px}px]`;
    }
    case "opacity": {
      const n = Math.round(parseFloat(v) * 100);
      return Number.isNaN(n) ? `opacity-[${v}]` : `opacity-${n}`;
    }
    case "z-index":
      return v === "0" ? "z-0" : `z-[${v}]`;
    case "border-radius":
      return radiusUtil(v);
    case "background":
      return v.startsWith("#") ? `bg-[${v}]` : `bg-[${a}]`;
    case "color":
      return `text-[${v}]`;
    case "font-size":
      return `text-[${a}]`;
    case "line-height":
      return `leading-[${a}]`;
    case "letter-spacing":
      return `tracking-[${a}]`;
    case "box-shadow":
      return `shadow-[${a}]`;
    case "border":
      return borderUtil("", v);
    case "border-top":
      return borderUtil("t", v);
    case "border-right":
      return borderUtil("r", v);
    case "border-bottom":
      return borderUtil("b", v);
    case "border-left":
      return borderUtil("l", v);
    default:
      return `[${k}:${a}]`;
  }
}
