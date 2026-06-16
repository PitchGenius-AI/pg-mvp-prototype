import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@pg/api/router';
import { API_URL } from './env';

// Inferred procedure outputs — lets the app type values against the real API shape
// for procedures that have no @pg/shared row schema (e.g. the diagnosis read-model).
export type RouterOutputs = inferRouterOutputs<AppRouter>;

const links = [
  httpBatchLink({
    url: `${API_URL}/trpc`,
    fetch: (url, options) =>
      fetch(url, {
        ...options,
        credentials: 'include',
      }),
  }),
];

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({ links });

// Vanilla (non-React) client for imperative calls outside the component tree —
// e.g. the TanStack Router `beforeLoad` route guard.
export const trpcVanilla = createTRPCClient<AppRouter>({ links });
