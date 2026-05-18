import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
import type { AppRouter } from '@pg/api/router';
import { API_URL } from './env';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      fetch: (url, options) =>
        fetch(url, {
          ...options,
          credentials: 'include',
        }),
    }),
  ],
});
