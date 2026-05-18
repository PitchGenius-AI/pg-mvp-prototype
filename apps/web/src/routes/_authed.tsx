import { AppShell } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { Sidebar } from '../components/layout/sidebar';
import { TopBar } from '../components/layout/top-bar';
import { useMockStore } from '../mock/store';

export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ location }) => {
    const session = useMockStore.getState().session;
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
