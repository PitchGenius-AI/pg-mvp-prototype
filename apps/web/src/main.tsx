import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { theme } from './theme';
import { routeTree } from './routeTree.gen';
import { trpc, trpcClient } from './trpc';
import { mockActions } from './mock/store';
import { buildSeed } from './mock/seed';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  // Matches Vite's `base` — '/' locally, '/<repo>/' on GitHub Pages — so client
  // routing works whether the app is mounted at the domain root or a sub-path.
  basepath: import.meta.env.BASE_URL,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Mock store still backs the UI until the M29 web cutover migrates each surface
// to the tRPC client wired below. Removed once the last surface is on the backend.
mockActions.hydrate(buildSeed());

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root');

createRoot(rootEl).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <ModalsProvider>
        <Notifications position="top-right" />
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </trpc.Provider>
      </ModalsProvider>
    </MantineProvider>
  </StrictMode>,
);
