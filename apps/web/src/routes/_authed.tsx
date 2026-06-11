import { AppShell } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { Sidebar } from '../components/layout/sidebar';
import { TopBar } from '../components/layout/top-bar';
import { authClient } from '../auth-client';
import { trpcVanilla } from '../trpc';

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ location }) => {
    const { data: session } = await authClient.getSession();
    if (!session) {
      throw redirect({
        to: '/login',
        // Capture intent so post-login navigation lands where the user was headed.
        search: { redirect: location.href },
      });
    }
    const current = await trpcVanilla.workspace.getCurrent.query();
    if (!current || !current.workspace.onboardingCompleted) {
      throw redirect({ to: '/onboarding' });
    }
    // Hard paywall (M11/M31): temporarily NOT enforced — the real Stripe gate
    // lands in M31. Until then an onboarded user reaches the app regardless of
    // subscriptionStatus. Re-enable here once billing is wired.
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const [navOpen, { toggle }] = useDisclosure();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !navOpen } }}
      padding="md"
    >
      <AppShell.Header>
        <TopBar navOpen={navOpen} onNavToggle={toggle} />
      </AppShell.Header>
      <AppShell.Navbar p="sm">
        <Sidebar />
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
