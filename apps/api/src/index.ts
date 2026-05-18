import { serve } from '@hono/node-server';
import { trpcServer } from '@hono/trpc-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth } from './auth';
import { createContext } from './context';
import { env } from './env';
import { appRouter } from './router';

const app = new Hono();

app.use('*', logger());

app.use(
  '*',
  cors({
    origin: env.WEB_URL,
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
