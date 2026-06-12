import { serve } from '@hono/node-server';
import { trpcServer } from '@hono/trpc-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth } from './auth';
import { createContext } from './context';
import { env } from './env';
import { appRouter } from './router';
import { DESKTOP_ORIGINS } from './origins';

const app = new Hono();

app.use('*', logger());

// Web (cookies, credentialed) + the Tauri desktop Co-pilot webview (bearer token,
// PG-289). Hono's cors callback echoes back the request origin when allowed, so a
// per-origin allowlist works alongside `credentials: true`.
const allowedOrigins = new Set<string>([env.WEB_URL, ...DESKTOP_ORIGINS]);
app.use(
  '*',
  cors({
    origin: (origin) => (allowedOrigins.has(origin) ? origin : null),
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.get('/health', (c) => c.json({ ok: true }));

// Better Auth mounts everything under /api/auth/*
app.all('/api/auth/*', (c) => auth.handler(c.req.raw));

// tRPC
app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext: (_opts, c) => createContext(c.req.raw),
  }),
);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://localhost:${info.port}`);
});

export type { AppRouter } from './router';
