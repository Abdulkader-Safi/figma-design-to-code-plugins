// CSS rule object -> Tailwind v4 utility classes. Idiomatic classes for the
// common layout cases; arbitrary values (w-[320px], bg-[#1a1f26]) keep exact
// pixel and colour fidelity; and an arbitrary property [prop:value] is the
// universal fallback for the rest (gradients, shadows, per-side borders). Spaces
// in a value become underscores, which Tailwind turns back into spaces.

import type { Rule } from "./types";

export function toTailwind(rule: Rule): string {
  return Object.keys(rule)
    .map((k) => twUtil(k, String(rule[k])))
    .filter(Boolean)
    .join(" ");
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
      return v === "1 1 0" || v === "1" ? "flex-1" : `[flex:${a}]`;
    case "flex-shrink":
      return v === "0" ? "shrink-0" : `[flex-shrink:${a}]`;
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
    case "gap":
      return `gap-[${a}]`;
    case "padding":
      return `p-[${a}]`;
    case "margin":
      return v === "0 auto" ? "mx-auto" : `m-[${a}]`;
    case "left":
    case "top":
    case "right":
    case "bottom":
      return `${k}-[${a}]`;
    case "opacity":
      return `opacity-[${v}]`;
    case "z-index":
      return `z-[${v}]`;
    case "border-radius":
      return `rounded-[${a}]`;
    case "background":
      return v.startsWith("#") ? `bg-[${v}]` : `[background:${a}]`;
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
    default:
      // font-weight, font-family, border, per-side borders, and anything else.
      return `[${k}:${a}]`;
  }
}
