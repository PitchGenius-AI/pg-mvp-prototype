import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@pg/api/router';

// Backend base URL — overridable via VITE_PG_API_URL (e.g. staging); the local
// API (apps/api) serves on :3000. Unlike the web app, the desktop authenticates
// with a bearer token (no cookie jar in a native app); the token is set after the
// deeplink handoff and refreshed from the OS keychain on launch (see ./auth).
export const API_BASE_URL = import.meta.env.VITE_PG_API_URL ?? 'http://localhost:3000';

let bearerToken: string | null = null;

/** Set (or clear, with null) the bearer token sent on every tRPC request. */
export function setBearerToken(token: string | null): void {
  bearerToken = token;
}

export function getBearerToken(): string | null {
  return bearerToken;
}

// One typed tRPC client for the whole desktop app. `headers` is evaluated per
// request, so it always reflects the current token (set/cleared via setBearerToken).
export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_BASE_URL}/trpc`,
      headers: () => (bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    }),
  ],
});
