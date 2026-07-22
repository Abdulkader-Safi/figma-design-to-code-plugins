// Design to HTML — exports the selected Figma frame, or a set of frames of one
// page, to a self-contained HTML/CSS file. Entry point: shows the UI and handles
// export requests.

import { generate, generateResponsive } from "./generate";
import { planExport } from "./responsive";
import { sanitizeFileName } from "./values";
import { dumpFixture } from "./fixture";

figma.showUI(__html__, { width: 600, height: 780, themeColors: true });

const selectedFrames = () =>
  figma.currentPage.selection.filter(
    (n) =>
      n.type === "FRAME" ||
      n.type === "COMPONENT" ||
      n.type === "INSTANCE" ||
      n.type === "GROUP",
  );

figma.ui.onmessage = async (msg: {
  type: string;
  semantic?: boolean;
  tailwind?: boolean;
}) => {
  // A fixture is the selection's node tree as JSON, with no pixels. It replays
  // the design outside Figma so a layout bug can be reproduced and fixed against
  // the real tree instead of guessing from an exported file.
  if (msg.type === "fixture") {
    const nodes = selectedFrames();
    if (nodes.length === 0) {
      figma.ui.postMessage({ type: "error", message: "Select a frame first." });
      return;
    }
    try {
      figma.ui.postMessage({
        type: "fixture",
        name: sanitizeFileName(nodes[0].name),
        json: dumpFixture(nodes),
        summary: `${nodes.length} frame${nodes.length === 1 ? "" : "s"} dumped`,
      });
    } catch (e) {
      figma.ui.postMessage({
        type: "error",
        message: "Dump failed: " + (e as Error).message,
      });
    }
    return;
  }

  if (msg.type !== "export") return;

  const nodes = selectedFrames();

  const plan = planExport(nodes);
  if (plan.kind === "error") {
    figma.ui.postMessage({ type: "error", message: plan.message });
    return;
  }

  const opts = {
    semantic: msg.semantic !== false,
    tailwind: msg.tailwind === true,
    onProgress: (message: string) =>
      figma.ui.postMessage({ type: "progress", message }),
  };

  try {
    let out;
    let name: string;
    let summary: string | undefined;
    if (plan.kind === "responsive") {
      out = await generateResponsive(plan.variants, opts);
      name = sanitizeFileName(plan.name);
      const parts = plan.variants.map((v) => {
        if (v.token !== "base") return v.token;
        const w = "width" in v.frame ? Math.round(v.frame.width) : 0;
        return `base ${w}`;
      });
      summary = `${plan.variants.length} frames -> ${parts.join(", ")}`;
    } else {
      out = await generate(plan.frame, opts);
      name = sanitizeFileName(plan.frame.name);
    }
    const note = "note" in out ? (out as { note?: string }).note : undefined;
    figma.ui.postMessage({
      type: "result",
      name,
      summary: [summary, note].filter(Boolean).join(". ") || undefined,
      combined: out.combined,
      html: out.html,
      css: out.css,
    });
  } catch (e) {
    figma.ui.postMessage({
      type: "error",
      message: "Export failed: " + (e as Error).message,
    });
  }
};
