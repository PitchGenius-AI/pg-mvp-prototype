import { NavLink, Stack } from '@mantine/core';
import {
  IconBox,
  IconFileExport,
  IconLayoutKanban,
  IconScript,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';
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
        to="/buyers"
        label="Buyers"
        leftSection={<IconUsers size={18} />}
        active={pathname.startsWith('/buyers')}
      />
      <NavLink
        component={Link}
        to="/products"
        label="Products"
        leftSection={<IconBox size={18} />}
        active={pathname.startsWith('/products')}
      />
      <NavLink
        component={Link}
        to="/scripts"
        label="Scripts"
        leftSection={<IconScript size={18} />}
        active={pathname.startsWith('/scripts')}
      />
      <NavLink
        component={Link}
        to="/export"
        label="CRM Update Pack"
        leftSection={<IconFileExport size={18} />}
        active={pathname.startsWith('/export')}
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
