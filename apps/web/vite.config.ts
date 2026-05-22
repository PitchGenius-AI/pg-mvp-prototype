import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Served from a repo sub-path on GitHub Pages (https://<org>.github.io/<repo>/).
  // CI sets PAGES_BASE to '/<repo>/'; local dev + other deploys stay at root.
  // Vite exposes this as import.meta.env.BASE_URL for the router + asset links.
  base: process.env.PAGES_BASE || '/',
  // Load .env from the monorepo root so we keep one env file for the whole stack.
  envDir: resolve(here, '../..'),
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
});
