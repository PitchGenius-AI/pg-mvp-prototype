import { Alert, Button, Group, Text } from '@mantine/core';
import { IconNotesOff } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';

interface NoActivityBannerProps {
  count: number;
}

// Pinned above the Workbench views when open opportunities have no activity yet
// (M15). Readiness for an activity-less deal is provisional — the banner points
// the rep at the bulk Activities import to backfill their CRM history in one go,
// or they can add activities one at a time on each opportunity.
export function NoActivityBanner({ count }: NoActivityBannerProps) {
  const navigate = useNavigate();
  if (count <= 0) return null;
  const subject = count === 1 ? 'opportunity has' : 'opportunities have';

  return (
    <Alert color="blue" variant="light" icon={<IconNotesOff size={18} />} p="sm">
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Text size="sm">
          <Text span fw={600}>
            {count} {subject}
          </Text>{' '}
          no activity yet — their readiness scores are provisional. Add a call,
          email, or note, or import your activity history, and the scores sharpen.
        </Text>
        <Button
          size="xs"
          variant="white"
          color="blue"
          onClick={() => navigate({ to: '/buyers/new', search: { method: 'activity' } })}
        >
          Import activity history
        </Button>
      </Group>
    </Alert>
  );
}
