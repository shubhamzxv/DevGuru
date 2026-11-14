import mdx from '@mdx-js/rollup';
import react from '@vitejs/plugin-react';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import { defineConfig } from 'vitest/config';

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
