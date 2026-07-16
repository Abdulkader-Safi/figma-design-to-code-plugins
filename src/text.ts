// Text styling: font, size, colour, and inline text properties, shared by a
// whole TextNode and by a single styled segment.

import type { Rule } from "./types";
import { solidFill, styleToWeight, round } from "./values";

// Fields shared by a TextNode and one styled segment. On the node these can be
// figma.mixed; on a segment they are always concrete.
export type TextStyleSource = {
  fontName: FontName | PluginAPI["mixed"];
  fontSize: number | PluginAPI["mixed"];
  fills: ReadonlyArray<Paint> | PluginAPI["mixed"];
  lineHeight: LineHeight | PluginAPI["mixed"];
  letterSpacing: LetterSpacing | PluginAPI["mixed"];
  textCase: TextCase | PluginAPI["mixed"];
  textDecoration: TextDecoration | PluginAPI["mixed"];
};

// Anything mixed is skipped, so this works for a uniform node and for a single
// styled segment alike.
export function styleRule(
  src: TextStyleSource,
  rule: Rule,
  addFont: (family: string, weight: number) => void,
) {
  const fn = src.fontName;
  if (fn !== figma.mixed) {
    const weight = styleToWeight(fn.style);
    rule["font-family"] = `'${fn.family}', sans-serif`;
    rule["font-weight"] = weight;
    if (fn.style.toLowerCase().includes("italic"))
      rule["font-style"] = "italic";
    addFont(fn.family, weight);
  }

  if (src.fontSize !== figma.mixed)
    rule["font-size"] = `${Math.round(src.fontSize)}px`;

  const color = solidFill(src.fills);
  if (color) rule.color = color;

  const lh = src.lineHeight;
  if (lh !== figma.mixed && lh.unit !== "AUTO") {
    rule["line-height"] =
      lh.unit === "PIXELS"
        ? `${Math.round(lh.value)}px`
        : `${round(lh.value / 100)}`;
  }

  const ls = src.letterSpacing;
  if (ls !== figma.mixed && ls.value !== 0) {
    rule["letter-spacing"] =
      ls.unit === "PERCENT"
        ? `${round(ls.value / 100)}em`
        : `${round(ls.value)}px`;
  }

  const tcase: { [k: string]: string } = {
    UPPER: "uppercase",
    LOWER: "lowercase",
    TITLE: "capitalize",
  };
  if (src.textCase !== figma.mixed && tcase[src.textCase])
    rule["text-transform"] = tcase[src.textCase];

  if (src.textDecoration === "UNDERLINE") rule["text-decoration"] = "underline";
  else if (src.textDecoration === "STRIKETHROUGH")
    rule["text-decoration"] = "line-through";
}

export const ALIGN: { [k: string]: string } = {
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
  JUSTIFIED: "justify",
};
