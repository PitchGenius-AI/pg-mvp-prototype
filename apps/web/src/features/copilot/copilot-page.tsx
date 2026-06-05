import {
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAppWindow,
  IconArrowBackUp,
  IconArrowRight,
  IconBroadcast,
  IconGauge,
  IconLock,
  IconMicrophone,
} from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { hasActiveSubscription } from '../../mock/access';
import { useCurrentWorkspace } from '../../mock/hooks';
import { useCopilot } from '../../mock/store';
import { ConnectPanel, ConnectedPanel } from './connection-panels';
import { DownloadSection } from './download-section';

// The Live Co-pilot's home base in the web app (M19, PG-233) — the `/copilot`
// screen behind the sidebar nav item. Not an in-browser call surface: the
// co-pilot itself is a desktop app. This screen is how the rep gets it, sees
// install/connection state, and launches it. It renders by install state:
//   not_installed → what it does + download (PG-234)
//   installed     → connect it to the account (PG-235)
//   connected     → status + launch (PG-233)
export function CopilotPage() {
  const copilot = useCopilot();
  const { data: workspace } = useCurrentWorkspace();

  // The desktop app is a thin client over the same account and the same paid
  // gate (PG-235). The hard paywall already bounces unpaid reps off every
  // `_authed` route, so this branch is belt-and-suspenders — but it keeps the
  // shared-gate rule visible on the surface that depends on it.
  if (workspace && !hasActiveSubscription(workspace)) {
    return (
      <Container size="md" py="lg">
        <SubscriptionRequired />
      </Container>
    );
  }

  return (
    <Container size="md" py="lg">
      <Stack gap="lg">
        <Stack gap={2}>
          <Title order={2}>PG.AI PILOT</Title>
          <Text size="sm" c="dimmed">
            Real-time coaching on your sales calls — live transcription, buyer-readiness cues,
            and the next question to ask, right when you're on the phone.
          </Text>
        </Stack>

        {copilot.installState === 'not_installed' && (
          <>
            <CopilotExplainer />
            <DownloadSection />
          </>
        )}
        {copilot.installState === 'installed' && <ConnectPanel />}
        {copilot.installState === 'connected' && <ConnectedPanel />}

        <OverlayMockLink />
      </Stack>
    </Container>
  );
}

// Entry point to the in-call overlay design mock (M20, PG-238/239). The overlay
// itself is part of the desktop app, not a web screen — this links to the
// static design gallery that stands in for it so the demo can show the in-call
// experience. Shown in every install state: it's a "what you're getting"
// preview as much as a feature surface.
function OverlayMockLink() {
  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" wrap="nowrap" gap="md">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon size={36} radius="md" variant="light" color="indigo">
            <IconAppWindow size={20} />
          </ThemeIcon>
          <div>
            <Text size="sm" fw={600}>
              See the in-call experience
            </Text>
            <Text size="sm" c="dimmed">
              A design mock of the overlay the desktop app shows while you're on
              a call.
            </Text>
          </div>
        </Group>
        <Button
          component={Link}
          to="/copilot/overlay"
          variant="default"
          rightSection={<IconArrowRight size={16} />}
          style={{ flexShrink: 0 }}
        >
          Preview
        </Button>
      </Group>
    </Paper>
  );
}

const FEATURES = [
  {
    icon: IconMicrophone,
    title: 'Live transcription',
    body: 'Transcribes both sides of the call as it happens — no note-taking, no recall gaps.',
  },
  {
    icon: IconGauge,
    title: 'Coaching in the moment',
    body: "A glanceable readiness state and the next question to ask, phrased in the deal's matched sales technique.",
  },
  {
    icon: IconArrowBackUp,
    title: 'Writes the call back',
    body: 'When the call ends, the transcript posts to the opportunity as an activity and re-scores the deal.',
  },
] as const;

// The "what it does" sell, shown only before the app is installed.
function CopilotExplainer() {
  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="md">
        <Text fw={600}>What PG.AI PILOT does</Text>
        {FEATURES.map((feature) => (
          <Group key={feature.title} gap="sm" wrap="nowrap" align="flex-start">
            <ThemeIcon size={32} radius="md" variant="light" color="indigo">
              <feature.icon size={18} />
            </ThemeIcon>
            <div>
              <Text size="sm" fw={600}>
                {feature.title}
              </Text>
              <Text size="sm" c="dimmed">
                {feature.body}
              </Text>
            </div>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}

// Defensive paid-gate state (PG-235) — unreachable behind the hard paywall, but
// it documents that the desktop app shares the workspace subscription.
function SubscriptionRequired() {
  return (
    <Paper withBorder radius="md" p="xl">
      <Stack align="center" gap="sm">
        <ThemeIcon size={48} radius="xl" variant="light" color="gray">
          <IconLock size={26} />
        </ThemeIcon>
        <Text fw={600}>PG.AI PILOT needs an active subscription</Text>
        <Text size="sm" c="dimmed" ta="center" maw={420}>
          The desktop app runs on your Pitch Genius subscription — the same account, the same
          plan. Activate your subscription to download and connect it.
        </Text>
        <Button
          component={Link}
          to="/checkout"
          leftSection={<IconBroadcast size={16} />}
          mt="xs"
        >
          Go to checkout
        </Button>
      </Stack>
    </Paper>
  );
}
