// Inlines the compiled Tailwind stylesheet into the panel template to produce
// ui.html. Figma loads exactly one UI file, so ui.html is a single
// self-contained generated artifact (like code.js). Run the Tailwind CLI first
// (the build:ui script does) to produce dist/ui.css.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const template = join(root, "src/ui/ui.template.html");
const css = join(root, "dist/ui.css");
const out = join(root, "ui.html");

const stylesheet = readFileSync(css, "utf8").trim();
// package.json is the single source of the version; the panel shows it so a bug
// report can name the build it came from.
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const html = readFileSync(template, "utf8")
  .replace(
    "/* __TAILWIND_CSS__ */",
    () => stylesheet, // function form: avoids $-pattern expansion in the CSS
  )
  .replaceAll("__VERSION__", version);
writeFileSync(out, html);
console.log(`ui.html written (${(html.length / 1024).toFixed(1)} kb)`);
