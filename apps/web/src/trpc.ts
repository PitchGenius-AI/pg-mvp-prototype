import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@pg/api/router';
import { API_URL } from './env';

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
