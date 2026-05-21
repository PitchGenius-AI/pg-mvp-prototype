import { Alert, Button, Stack, Text } from '@mantine/core';
import { IconArrowRight, IconBroadcast } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { mockActions, useCopilot, useCopilotNudgeDismissed } from '../../mock/store';

// Contextual, non-blocking Co-pilot download nudge (M19, PG-237). Rendered on
// Opportunity Detail, so "the workspace has >=1 opportunity" — the gate that
// makes the desktop app worth pitching — is already true by construction. Shows
// only while the app isn't installed and the rep hasn't dismissed it; once
// dismissed (or once installed) it stays gone. There is deliberately no
// post-onboarding download popup — the permanent sidebar nav item is the
// durable home, and this is just a single in-context prompt.
export function CopilotDownloadNudge() {
  const copilot = useCopilot();
  const dismissed = useCopilotNudgeDismissed();
  const navigate = useNavigate();

  if (copilot.installState !== 'not_installed' || dismissed) return null;

  return (
    <Alert
      variant="light"
      color="indigo"
      icon={<IconBroadcast size={18} />}
      title="Get real-time coaching on this call"
      withCloseButton
      closeButtonLabel="Dismiss"
      onClose={() => mockActions.dismissCopilotNudge()}
    >
      <Stack gap="xs" align="flex-start">
        <Text size="sm">
          The Live Co-pilot is a desktop app that transcribes your call and coaches you while
          you're on it. Set it up before your next conversation with this buyer.
        </Text>
        <Button
          size="xs"
          variant="light"
          rightSection={<IconArrowRight size={14} />}
          onClick={() => navigate({ to: '/copilot' })}
        >
          Get the desktop app
        </Button>
      </Stack>
    </Alert>
  );
}
