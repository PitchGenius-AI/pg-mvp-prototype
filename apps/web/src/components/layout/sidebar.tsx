import { NavLink, Stack } from '@mantine/core';
import { IconLayoutKanban, IconSettings } from '@tabler/icons-react';
import { Link, useLocation } from '@tanstack/react-router';

export function Sidebar() {
  const { pathname } = useLocation();
  return (
    <Stack gap={4}>
      <NavLink
        component={Link}
        to="/"
        label="Workbench"
        leftSection={<IconLayoutKanban size={18} />}
        // Detail pages (`/opportunities/$id`) belong to the workbench flow.
        active={pathname === '/' || pathname.startsWith('/opportunities')}
      />
      <NavLink
        component={Link}
        to="/settings"
        label="Settings"
        leftSection={<IconSettings size={18} />}
        active={pathname.startsWith('/settings')}
      />
    </Stack>
  );
}
