import { Burger, Group, Text } from '@mantine/core';
import { useMockStore } from '../../mock/store';
import { Brand } from './brand';
import { ColorSchemeToggle } from './color-scheme-toggle';
import { UserMenu } from './user-menu';

interface TopBarProps {
  navOpen: boolean;
  onNavToggle: () => void;
}

export function TopBar({ navOpen, onNavToggle }: TopBarProps) {
  const workspace = useMockStore((s) =>
    s.session ? s.workspaces[s.session.workspaceId] ?? null : null,
  );

  return (
    <Group h="100%" px="md" justify="space-between">
      <Group gap="sm">
        <Burger opened={navOpen} onClick={onNavToggle} hiddenFrom="sm" size="sm" />
        <Brand />
      </Group>
      {workspace && (
        <Text size="sm" c="dimmed" visibleFrom="sm">
          {workspace.name}
        </Text>
      )}
      <Group gap="xs">
        <ColorSchemeToggle />
        <UserMenu />
      </Group>
    </Group>
  );
}
