// Design to HTML — exports the selected Figma frame, or a set of frames of one
// page, to a self-contained HTML/CSS file. Entry point: shows the UI and handles
// export requests.

import { generate, generateResponsive } from "./generate";
import { planExport } from "./responsive";
import { sanitizeFileName } from "./values";

figma.showUI(__html__, { width: 600, height: 780, themeColors: true });

figma.ui.onmessage = async (msg: {
  type: string;
  semantic?: boolean;
  tailwind?: boolean;
}) => {
  if (msg.type !== "export") return;

  const nodes = figma.currentPage.selection.filter(
    (n) =>
      n.type === "FRAME" ||
      n.type === "COMPONENT" ||
      n.type === "INSTANCE" ||
      n.type === "GROUP",
  );

  const plan = planExport(nodes);
  if (plan.kind === "error") {
    figma.ui.postMessage({ type: "error", message: plan.message });
    return;
  }

  const opts = {
    semantic: msg.semantic !== false,
    tailwind: msg.tailwind === true,
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
    figma.ui.postMessage({
      type: "result",
      name,
      summary,
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
