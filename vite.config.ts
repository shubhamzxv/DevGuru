import mdx from '@mdx-js/rollup';
import react from '@vitejs/plugin-react';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import contentPlugin from './src/build/contentPlugin';
import pwaPlugin from './src/build/pwaPlugin';

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [
    // Turns every .mdx file into a React component.
    // The block between --- lines at the top is exported as `frontmatter`.
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [
          remarkFrontmatter,
          [remarkMdxFrontmatter, { name: 'frontmatter' }],
          remarkGfm,
        ],
      }),
    },
    react(),
    // Search index + cheat sheets, read from src/content at build time.
    contentPlugin(fromRoot('./src/content')),
    // dist/sw.js: saves the app for offline use.
    pwaPlugin(fromRoot('./src/build/sw.template.js')),
  ],
  // The Python worker uses import(), which needs an ES-module worker.
  worker: { format: 'es' },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
