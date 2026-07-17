// Group a multi-frame selection into a responsive export plan. Frames that share
// a name prefix (the part before the last " - ") are one responsive set; the
// suffix is a label only, the breakpoint comes from width.

import { assignBreakpoints, type Token } from "./breakpoints";

export function parseFrameName(name: string): { prefix: string; variant: string } {
  const i = (name || "").lastIndexOf(" - ");
  if (i === -1) return { prefix: name || "", variant: "" };
  return { prefix: name.slice(0, i), variant: name.slice(i + 3) };
}

export interface FrameVariant {
  frame: SceneNode;
  token: Token;
  minWidth: number;
  variant: string;
}

export type ExportPlan =
  | { kind: "single"; frame: SceneNode }
  | { kind: "responsive"; name: string; variants: FrameVariant[] }
  | { kind: "error"; message: string };

export function planExport(frames: SceneNode[]): ExportPlan {
  if (frames.length === 0) {
    return {
      kind: "error",
      message: "Select a frame, or several frames of one page to make it responsive.",
    };
  }
  if (frames.length === 1) return { kind: "single", frame: frames[0] };

  // Group by prefix, preserving each frame's parsed variant.
  const groups = new Map<string, { frame: SceneNode; variant: string }[]>();
  for (const frame of frames) {
    const { prefix, variant } = parseFrameName(frame.name);
    const g = groups.get(prefix) || [];
    g.push({ frame, variant });
    groups.set(prefix, g);
  }

  // Exactly one group with 2+ frames, and nothing else selected -> responsive.
  const sets = [...groups.entries()].filter(([, g]) => g.length >= 2);
  if (sets.length === 1 && groups.size === 1) {
    const [name, members] = sets[0];
    const widths = members.map((m) => ("width" in m.frame ? m.frame.width : 0));
    let assigned;
    try {
      assigned = assignBreakpoints(widths);
    } catch (e) {
      return { kind: "error", message: (e as Error).message };
    }
    const variants: FrameVariant[] = assigned
      .map((a) => ({
        frame: members[a.index].frame,
        token: a.token,
        minWidth: a.minWidth,
        variant: members[a.index].variant,
      }))
      .sort((x, y) => x.minWidth - y.minWidth);
    return { kind: "responsive", name, variants };
  }

  // Anything ambiguous: list the groups and refuse to guess.
  const names = [...groups.keys()].join(", ");
  return {
    kind: "error",
    message: `Selected frames belong to different pages (${names}). Select the frames of one page, named like "Home - Desktop", "Home - Mobile".`,
  };
}
