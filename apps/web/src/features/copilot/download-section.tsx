import {
  Anchor,
  Button,
  Collapse,
  Divider,
  Group,
  List,
  Loader,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBrandApple,
  IconBrandWindows,
  IconChevronDown,
  IconDownload,
  IconMicrophone,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  COPILOT_DOWNLOAD_SIZE,
  COPILOT_OS_REQUIREMENTS,
  COPILOT_PLATFORM_LABELS,
  detectOs,
} from '../../lib/copilot';
import { mockActions } from '../../mock/store';
import type { CopilotPlatform } from '../../mock/types';

// The download surface (M19, PG-234). Both builds are always offered; OS
// detection only promotes the likely one to the primary button. Mock: no real
// installer downloads — clicking a build runs a believable "preparing" beat,
// then hands off to a finish-installing panel whose confirm button flips the
// mock client to "installed".
const PREPARING_MS = 1100;

type Phase = 'idle' | 'preparing' | 'ready';

const PLATFORM_ICON: Record<CopilotPlatform, typeof IconBrandApple> = {
  macos: IconBrandApple,
  windows: IconBrandWindows,
};

export function DownloadSection() {
  const detected = useMemo(detectOs, []);
  const [phase, setPhase] = useState<Phase>('idle');
  // The build the rep picked — defaults to the detected OS until they choose.
  const [chosen, setChosen] = useState<CopilotPlatform>(detected);
  const [reqsOpen, { toggle: toggleReqs }] = useDisclosure(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const startDownload = (platform: CopilotPlatform) => {
    setChosen(platform);
    setPhase('preparing');
    timer.current = window.setTimeout(() => {
      setPhase('ready');
      timer.current = null;
    }, PREPARING_MS);
  };

  if (phase === 'preparing') {
    return (
      <Paper withBorder radius="md" p="xl">
        <Stack align="center" gap="sm">
          <Loader size="sm" />
          <Text fw={600}>Preparing your {COPILOT_PLATFORM_LABELS[chosen]} download…</Text>
        </Stack>
      </Paper>
    );
  }

  if (phase === 'ready') {
    return (
      <Paper withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size={40} radius="md" variant="light" color="indigo">
              <IconDownload size={22} />
            </ThemeIcon>
            <div>
              <Text fw={600}>Finish installing</Text>
              <Text size="xs" c="dimmed">
                {COPILOT_PLATFORM_LABELS[chosen]} build
              </Text>
            </div>
          </Group>
          <Text size="sm" c="dimmed">
            This is a prototype, so no real installer downloads. In the shipped product the
            {` ${COPILOT_PLATFORM_LABELS[chosen]} `}installer would now be in your Downloads
            folder — run it, then come back here to connect the app to your account.
          </Text>
          <Group gap="xs" mt={4}>
            <Button onClick={() => mockActions.installCopilot(chosen)}>
              I've installed the app
            </Button>
            <Button variant="subtle" color="gray" onClick={() => setPhase('idle')}>
              Back to downloads
            </Button>
          </Group>
        </Stack>
      </Paper>
    );
  }

  const PrimaryIcon = PLATFORM_ICON[detected];
  const other: CopilotPlatform = detected === 'macos' ? 'windows' : 'macos';
  const OtherIcon = PLATFORM_ICON[other];

  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="md">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon size={40} radius="md" variant="light" color="indigo">
            <IconDownload size={22} />
          </ThemeIcon>
          <div>
            <Text fw={600}>Download the desktop app</Text>
            <Text size="xs" c="dimmed">
              Included with your subscription · {COPILOT_DOWNLOAD_SIZE}
            </Text>
          </div>
        </Group>

        <Group gap="sm" align="center" wrap="wrap">
          <Button
            leftSection={<PrimaryIcon size={18} />}
            onClick={() => startDownload(detected)}
          >
            Download for {COPILOT_PLATFORM_LABELS[detected]}
          </Button>
          <Button
            variant="subtle"
            color="gray"
            leftSection={<OtherIcon size={16} />}
            onClick={() => startDownload(other)}
          >
            Download for {COPILOT_PLATFORM_LABELS[other]}
          </Button>
        </Group>
        <Text size="xs" c="dimmed">
          We detected {COPILOT_PLATFORM_LABELS[detected]}. On a different machine, grab the
          other build instead.
        </Text>

        <Divider />

        <Group gap="xs" wrap="nowrap" align="flex-start">
          <ThemeIcon size={22} radius="xl" variant="light" color="gray">
            <IconMicrophone size={13} />
          </ThemeIcon>
          {/* [FLAG] exact permission wording depends on OS entitlements —
              finalize with engineering before launch. */}
          <Text size="xs" c="dimmed">
            On first launch the app asks for microphone access so it can transcribe your calls.
            Nothing is recorded until you start a session.
          </Text>
        </Group>

        <div>
          <Anchor
            component="button"
            type="button"
            size="xs"
            c="dimmed"
            onClick={toggleReqs}
          >
            <Group gap={4} wrap="nowrap" component="span">
              System requirements
              <IconChevronDown
                size={13}
                style={{
                  transform: reqsOpen ? 'rotate(180deg)' : undefined,
                  transition: 'transform 150ms ease',
                }}
              />
            </Group>
          </Anchor>
          <Collapse in={reqsOpen}>
            <List size="xs" c="dimmed" spacing={2} mt={6}>
              <List.Item>{COPILOT_OS_REQUIREMENTS.macos}</List.Item>
              <List.Item>{COPILOT_OS_REQUIREMENTS.windows}</List.Item>
              <List.Item>A microphone, and permission to use it</List.Item>
              <List.Item>An active Pitch Genius subscription</List.Item>
            </List>
          </Collapse>
        </div>
      </Stack>
    </Paper>
  );
}
