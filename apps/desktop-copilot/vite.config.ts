import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Tauri drives this dev server (beforeDevCommand) and expects a fixed port.
// 1420 is the Tauri convention; web app already owns 5173.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  // Tauri owns the terminal output; don't let Vite clear it.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Don't watch the Rust side from Vite.
      ignored: ['**/src-tauri/**'],
    },
  },
  // macOS WKWebView target; matches Tauri's recommended build target.
  build: {
    target: 'safari15',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
