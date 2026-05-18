import { NavLink, Stack } from '@mantine/core';
import { IconLayoutGrid, IconSettings } from '@tabler/icons-react';
import { Link, useLocation } from '@tanstack/react-router';

export function Sidebar() {
  const location = useLocation();
  return (
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
  );
}
