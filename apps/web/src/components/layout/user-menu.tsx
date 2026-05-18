import { Avatar, Group, Menu, Stack, Text, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChevronDown, IconLogout, IconUser } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { useClearSession } from '../../mock/hooks';
import { useMockStore } from '../../mock/store';

export function UserMenu() {
  const session = useMockStore((s) => s.session);
  const { mutate: signOut } = useClearSession();
  const navigate = useNavigate();

  if (!session) return null;

  const initials = computeInitials(session.user.name);

  return (
    <Menu shadow="md" width={240} position="bottom-end" withArrow>
      <Menu.Target>
        <UnstyledButton aria-label="User menu">
          <Group gap="xs">
            <Avatar color="blue" radius="xl" size="sm">
              {initials}
            </Avatar>
            <IconChevronDown size={14} />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Stack gap={2} px="sm" py="xs">
          <Text size="sm" fw={500}>
            {session.user.name}
          </Text>
          <Text size="xs" c="dimmed">
            {session.user.email}
          </Text>
        </Stack>
        <Menu.Divider />
        <Menu.Item
          leftSection={<IconUser size={16} />}
          onClick={() =>
            notifications.show({
              title: 'Not implemented in prototype',
              message: 'Profile editing will land with the real backend.',
            })
          }
        >
          Profile
        </Menu.Item>
        <Menu.Item
          leftSection={<IconLogout size={16} />}
          color="red"
          onClick={() =>
            signOut(undefined, {
              onSuccess: () => {
                navigate({ to: '/login' });
              },
            })
          }
        >
          Sign out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

// "Casey Morgan" → "CM"; "Casey" → "C"; falls back to "?".
function computeInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase() || '?';
}
