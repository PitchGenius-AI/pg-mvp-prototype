import { Alert, Button, Group, Text } from '@mantine/core';
import { IconUsers } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';

interface UnassignedBannerProps {
  count: number;
  onDismiss?: () => void;
}

// Pinned above the Workbench views when the workspace has buyers with no product
// assigned (PG-203) — typically from a deferred Daily Workbench import. Hidden
// entirely when there are none. The CTA deep-links to /buyers pre-filtered to
// Unassigned, where the M13 assignment flow lives.
//
// [FLAG] CTA + body wording is placeholder pending final copy.
export function UnassignedBanner({ count, onDismiss }: UnassignedBannerProps) {
  const navigate = useNavigate();
  if (count <= 0) return null;
  const one = count === 1;

  return (
    <Alert
      color="yellow"
      variant="light"
      icon={<IconUsers size={18} />}
      p="sm"
      withCloseButton={Boolean(onDismiss)}
      onClose={onDismiss}
      closeButtonLabel="Dismiss"
    >
      <Group justify="space-between" align="center" wrap="wrap" gap="sm" pr="xl">
        <Text size="sm">
          <Text span fw={600}>
            {count} imported {one ? 'buyer' : 'buyers'}
          </Text>{' '}
          {one ? "doesn't" : "don't"} have a product yet, so they're not on your workbench. Assign{' '}
          {one ? 'them' : 'each'} a product to start scoring them.
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
