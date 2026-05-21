import { Alert, Button, Group, Text } from '@mantine/core';
import { IconUsers } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';

interface UnassignedBannerProps {
  count: number;
}

// Pinned above the Workbench views when the workspace has buyers with no product
// assigned (PG-203) — typically from a deferred Daily Workbench import. Hidden
// entirely when there are none. The CTA deep-links to /buyers pre-filtered to
// Unassigned, where the M13 assignment flow lives.
//
// [FLAG] CTA + body wording is placeholder pending final copy.
export function UnassignedBanner({ count }: UnassignedBannerProps) {
  const navigate = useNavigate();
  if (count <= 0) return null;
  const plural = count === 1 ? 'buyer' : 'buyers';

  return (
    <Alert color="yellow" variant="light" icon={<IconUsers size={18} />} p="sm">
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Text size="sm">
          <Text span fw={600}>
            {count} imported {plural}
          </Text>{' '}
          {count === 1 ? "doesn't have" : "don't have"} a product yet — assign one to start
          tracking {count === 1 ? 'it' : 'them'} on your workbench.
        </Text>
        <Button
          size="xs"
          variant="white"
          color="yellow"
          onClick={() => navigate({ to: '/buyers', search: { status: 'unassigned' } })}
        >
          Assign products
        </Button>
      </Group>
    </Alert>
  );
}
