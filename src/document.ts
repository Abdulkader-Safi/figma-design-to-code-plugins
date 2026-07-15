// Document assembly: the Google Fonts <link>, and the HTML shell.

import { escapeHtml } from "./values";

export function fontLink(fonts: Map<string, Set<number>>): string {
  if (fonts.size === 0) return "";
  const families = Array.from(fonts.entries())
    .map(
      ([fam, weights]) =>
        `family=${fam.replace(/ /g, "+")}:wght@${Array.from(weights)
          .sort((a, b) => a - b)
          .join(";")}`,
    )
    .join("&");
  return (
    `<link rel="preconnect" href="https://fonts.googleapis.com">\n` +
    `  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n` +
    `  <link href="https://fonts.googleapis.com/css2?${families}&display=swap" rel="stylesheet">`
  );
}

export function docShell(
  title: string,
  links: string,
  head: string,
  body: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${links}
${head}
</head>
<body>
${body}
</body>
</html>`;
}
