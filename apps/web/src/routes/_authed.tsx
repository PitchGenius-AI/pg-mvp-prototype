import { AppShell, Box, Burger, Group, NavLink, Stack, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconLayoutGrid,
  IconLogout,
  IconSettings,
  IconTargetArrow,
} from '@tabler/icons-react';
import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
  useNavigate,
} from '@tanstack/react-router';
import { useMockStore } from '../mock/store';
import { useClearSession } from '../mock/hooks';

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
  const session = useMockStore((s) => s.session);
  const workspace = useMockStore((s) =>
    s.session ? s.workspaces[s.session.workspaceId] ?? null : null,
  );
  const { mutate: signOutMutate } = useClearSession();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = () => {
    signOutMutate(undefined, {
      onSuccess: () => {
        navigate({ to: '/login' });
      },
    });
  };

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !navOpen } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={navOpen} onClick={toggle} hiddenFrom="sm" size="sm" />
            <IconTargetArrow size={20} />
            <Text fw={600}>Pitch Genius</Text>
            {workspace && (
              <Text c="dimmed" size="sm">
                · {workspace.name}
              </Text>
            )}
          </Group>
          {session && (
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                {session.user.name}
              </Text>
              <Tooltip label="Sign out">
                <NavLink
                  component="button"
                  type="button"
                  onClick={handleSignOut}
                  label=""
                  leftSection={<IconLogout size={16} />}
                  variant="subtle"
                  w={36}
                  styles={{ root: { padding: 8 } }}
                />
              </Tooltip>
            </Group>
          )}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <Stack gap={4}>
          <NavLink
            component={Link}
            to="/opportunities"
            label="Opportunities"
            leftSection={<IconLayoutGrid size={18} />}
            active={location.pathname.startsWith('/opportunities')}
          />
          <NavLink
            component={Link}
            to="/settings"
            label="Settings"
            leftSection={<IconSettings size={18} />}
            active={location.pathname.startsWith('/settings')}
          />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Box>
          <Outlet />
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
