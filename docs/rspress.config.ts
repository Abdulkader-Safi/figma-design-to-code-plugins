import * as path from 'node:path';
import { defineConfig } from '@rspress/core';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  base: '/',
  lang: 'en',
  title: 'Design to HTML',
  description:
    'Turn a Figma frame into clean, semantic HTML. A guide to naming layers, using auto layout, and exporting CSS or Tailwind.',
  icon: '/logo.png',
  logo: '/logo.png',
  logoText: 'Design to HTML',
  themeConfig: {
    outlineTitle: 'On this page',
    prevPageText: 'Previous',
    nextPageText: 'Next',
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/Abdulkader-Safi',
      },
    ],
  },
});
