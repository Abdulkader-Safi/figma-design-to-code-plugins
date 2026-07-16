// Design to HTML — exports the selected Figma frame to a self-contained
// HTML/CSS file. Entry point: shows the UI and handles export requests.

import { generate } from "./generate";
import { sanitizeFileName } from "./values";

figma.showUI(__html__, { width: 600, height: 780, themeColors: true });

figma.ui.onmessage = async (msg: {
  type: string;
  semantic?: boolean;
  tailwind?: boolean;
}) => {
  if (msg.type !== "export") return;

  const sel = figma.currentPage.selection;
  const root = sel.find(
    (n) =>
      n.type === "FRAME" ||
      n.type === "COMPONENT" ||
      n.type === "INSTANCE" ||
      n.type === "GROUP",
  );
  if (!root) {
    figma.ui.postMessage({
      type: "error",
      message: "Select a frame, component, or group to export.",
    });
    return;
  }

  try {
    const out = await generate(root, {
      semantic: msg.semantic !== false,
      tailwind: msg.tailwind === true,
    });
    figma.ui.postMessage({
      type: "result",
      name: sanitizeFileName(root.name),
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
