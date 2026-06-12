// Origins the Tauri desktop Co-pilot webview makes requests from (M33/PG-289).
// Dev: the Vite dev server URL (tauri.conf.json `devUrl`). Prod: Tauri's webview
// origins (custom `tauri://` scheme on macOS, `tauri.localhost` on Windows).
// The desktop authenticates with a bearer token (no cookies), but CORS and
// Better Auth `trustedOrigins` still gate these cross-origin requests, so both
// must allowlist them.
export const DESKTOP_ORIGINS = [
  'http://localhost:1420',
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
] as const;
