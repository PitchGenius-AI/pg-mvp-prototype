import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconBroadcast,
  IconCircleCheck,
  IconDeviceLaptop,
  IconInfoCircle,
  IconPlugConnected,
} from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { COPILOT_PLATFORM_LABELS } from '../../lib/copilot';
import { mockActions, useCopilot } from '../../mock/store';
import type { CopilotClient } from '../../mock/types';
import { useStartCopilot } from './use-start-copilot';

// Connection + launch panels for the `/copilot` screen (M19, PG-233/235). The
// desktop app is a thin client over the same account and the same paid gate, so
// "connecting" is mocked as a short authenticate beat.
const CONNECTING_MS = 1500;

// A one-line "installed" summary — the build's version + OS — shared by the
// connect and connected panels.
function buildLine(copilot: CopilotClient): string {
  const parts = [`Version ${copilot.version}`];
  if (copilot.platform) parts.push(COPILOT_PLATFORM_LABELS[copilot.platform]);
  return parts.join(' · ');
}

// installState === 'installed' — downloaded, but not yet signed in (PG-235).
export function ConnectPanel() {
  const copilot = useCopilot();
  const [connecting, setConnecting] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const handleConnect = () => {
    setConnecting(true);
    timer.current = window.setTimeout(() => {
      // The store flip swaps this panel out for ConnectedPanel; the cleanup
      // above covers the case where the rep navigates away mid-connect.
      mockActions.connectCopilot();
      timer.current = null;
    }, CONNECTING_MS);
  };

  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="md">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon size={40} radius="md" variant="light" color="teal">
            <IconCircleCheck size={22} />
          </ThemeIcon>
          <div>
            <Text fw={600}>Desktop app installed</Text>
            <Text size="xs" c="dimmed">
              {buildLine(copilot)}
            </Text>
          </div>
        </Group>

        <Divider />

        <Stack gap={6}>
          <Text fw={600} size="sm">
            Connect it to your account
          </Text>
          <Text size="sm" c="dimmed">
            The desktop app is a thin client over this same workspace — it signs in with your
            Pitch Genius login and runs on your existing subscription. Connect it so it can pull
            your opportunities and pre-call intelligence.
          </Text>
        </Stack>

        <Button
          leftSection={<IconPlugConnected size={18} />}
          onClick={handleConnect}
          loading={connecting}
          w="fit-content"
        >
          Connect to your account
        </Button>
      </Stack>
    </Paper>
  );
}

// installState === 'connected' — installed and signed in; ready to launch (PG-233).
export function ConnectedPanel() {
  const copilot = useCopilot();
  const startCopilot = useStartCopilot();

  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="lg">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon size={40} radius="md" variant="light" color="teal">
                <IconDeviceLaptop size={22} />
              </ThemeIcon>
              <div>
                <Group gap="xs">
                  <Text fw={600}>PG.AI PILOT connected</Text>
                  <Badge size="sm" variant="light" color="teal">
                    Ready
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  {buildLine(copilot)}
                </Text>
              </div>
            </Group>
          </Group>

          <Divider />

          <Group gap="xs">
            <Button
              leftSection={<IconBroadcast size={18} />}
              onClick={() => startCopilot()}
            >
              Launch PG.AI PILOT
            </Button>
            <Button
              variant="subtle"
              color="gray"
              onClick={() => mockActions.disconnectCopilot()}
            >
              Disconnect this device
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Alert variant="light" color="indigo" icon={<IconInfoCircle size={18} />}>
        <Text size="sm">
          Launching here opens the app to its own opportunity picker. To start a call already
          bound to a deal, use the <Text span fw={600}>Start PG.AI PILOT</Text> button in any
          opportunity's header.
        </Text>
      </Alert>
    </Stack>
  );
}
