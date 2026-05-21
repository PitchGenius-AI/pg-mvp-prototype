import { AppShell } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { Sidebar } from '../components/layout/sidebar';
import { TopBar } from '../components/layout/top-bar';
import { hasActiveSubscription } from '../mock/access';
import { useMockStore } from '../mock/store';

export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ location }) => {
    const { session, workspaces } = useMockStore.getState();
    if (!session) {
      throw redirect({
        to: '/login',
        // Capture intent so post-login navigation lands where the user was headed.
        search: { redirect: location.href },
      });
    }
    if (!session.workspaceOnboardingCompleted) {
      throw redirect({ to: '/onboarding' });
    }
    // Hard paywall (M11): an onboarded-but-unpaid workspace can't reach any
    // in-shell route — every `_authed` child bounces to /checkout until payment.
    if (!hasActiveSubscription(workspaces[session.workspaceId])) {
      throw redirect({ to: '/checkout' });
    }
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
