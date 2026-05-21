import {
  Alert,
  Anchor,
  Box,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconFlag,
  IconInfoCircle,
} from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { OpportunityPickerMock } from './opportunity-picker-mock';
import {
  NudgeOverlay,
  PillOverlay,
  PostCallConfirmedOverlay,
  PostCallProcessingOverlay,
  RestingOverlay,
  UnboundOverlay,
} from './overlay-states';

// The in-call overlay design-mock showcase (M20, PG-238/239). The overlay is
// part of the Live Co-pilot *desktop app* — explicitly not a web route — so it
// can't be a working screen in this web prototype. This page is the agreed
// substitute: a static gallery of the overlay's states so the client demo can
// show the in-call concept. Reached from `/copilot`; not in the sidebar nav,
// because it isn't an app surface the rep returns to.

// How a call reaches the overlay — the three launch paths, named here so the
// gallery's picker and unbound states have context.
const LAUNCH_PATHS = [
  {
    n: 1,
    title: 'From an opportunity',
    body: 'The rep clicks “Start live co-pilot” in a deal\'s header. The call opens already bound to that buyer — the happy path.',
  },
  {
    n: 2,
    title: 'From the Live Co-pilot screen',
    body: 'Launching with no deal attached opens the desktop app\'s own opportunity picker, so the rep binds the call before it starts.',
  },
  {
    n: 3,
    title: 'Standalone',
    body: 'Skipping the picker starts the call unbound — coaching still runs, but the overlay warns that nothing will be saved back.',
  },
] as const;

// A representative "floating over a call" backdrop for a mocked window. Kept
// dark on purpose: the overlay lives over a video call, and a dark stage makes
// the window's elevation read regardless of the web app's colour scheme.
function MockStage({ children }: { children: ReactNode }) {
  return (
    <Box
      style={{
        background:
          'linear-gradient(135deg, #2b2e3d 0%, #1c1d26 55%, #15161d 100%)',
        borderRadius: 16,
        border: '1px solid var(--mantine-color-dark-4)',
      }}
      px="xl"
      py={44}
    >
      <Group justify="center" align="flex-start" gap="xl" wrap="wrap">
        {children}
      </Group>
    </Box>
  );
}

interface MockSectionProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

function MockSection({ eyebrow, title, description, children }: MockSectionProps) {
  return (
    <Stack gap="sm">
      <div>
        <Text size="xs" fw={700} tt="uppercase" c="indigo" lts={0.6}>
          {eyebrow}
        </Text>
        <Title order={3} mt={2}>
          {title}
        </Title>
        <Text size="sm" c="dimmed" mt={4} maw={620}>
          {description}
        </Text>
      </div>
      <MockStage>{children}</MockStage>
    </Stack>
  );
}

export function OverlayMockPage() {
  return (
    <Container size="lg" py="lg">
      <Stack gap="xl">
        {/* Header + the all-important "this is a mock" framing. */}
        <Stack gap="sm">
          <Anchor component={Link} to="/copilot" size="sm" c="dimmed">
            <Group gap={4} wrap="nowrap">
              <IconArrowLeft size={14} />
              Back to Live Co-pilot
            </Group>
          </Anchor>
          <Stack gap={2}>
            <Title order={2}>In-call overlay</Title>
            <Text size="sm" c="dimmed">
              What the Live Co-pilot looks like while the rep is on a call —
              live coaching in the deal's matched sales technique.
            </Text>
          </Stack>
        </Stack>

        <Alert
          variant="light"
          color="indigo"
          icon={<IconInfoCircle size={18} />}
          title="This is a design mock, not a working screen"
        >
          <Text size="sm">
            The in-call overlay is part of the Live Co-pilot desktop app — a
            cross-platform application, not a web page — so it can't run inside
            this web prototype. The mock-ups below are static design artifacts:
            nothing on them is interactive. The desktop app itself is a separate
            future-phase build.
          </Text>
        </Alert>

        {/* The three launch paths — sets up the picker + unbound states. */}
        <Paper withBorder radius="md" p="lg">
          <Stack gap="md">
            <Text fw={600}>How a call reaches the overlay</Text>
            {LAUNCH_PATHS.map((path) => (
              <Group key={path.n} gap="sm" wrap="nowrap" align="flex-start">
                <ThemeIcon size={26} radius="xl" variant="light" color="indigo">
                  <Text fz={12} fw={700}>
                    {path.n}
                  </Text>
                </ThemeIcon>
                <div>
                  <Text size="sm" fw={600}>
                    {path.title}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {path.body}
                  </Text>
                </div>
              </Group>
            ))}
          </Stack>
        </Paper>

        {/* --- The gallery ------------------------------------------------ */}

        <MockSection
          eyebrow="Before the call"
          title="Opportunity picker"
          description="Launched without a deal attached, the desktop app opens here first so the rep can bind the call to an opportunity — that's what lets the co-pilot load pre-call intelligence and save the call back afterwards."
        >
          <OpportunityPickerMock />
        </MockSection>

        <MockSection
          eyebrow="During the call · resting"
          title="The in-call hero"
          description="The overlay's resting state: one prompt card in the deal's matched technique, a quiet glanceable readiness state — never the 0–100 score — and the script and questions kept collapsed, so exactly one thing is ever asking for the rep's attention."
        >
          <RestingOverlay />
        </MockSection>

        <MockSection
          eyebrow="During the call · nudge"
          title="The missing-question nudge"
          description="When the co-pilot notices the rep has skipped something the technique calls for, the prompt escalates: a “Still need to ask” nudge with the missing question, phrased as the next technique move. The planned move folds away beneath it."
        >
          <NudgeOverlay />
        </MockSection>

        <MockSection
          eyebrow="During the call · collapsed"
          title="Collapsed to a pill"
          description="The overlay's smallest footprint — for when the rep wants the screen back. It stays out of the way but keeps a count of prompts waiting, ready to expand."
        >
          <PillOverlay />
        </MockSection>

        <MockSection
          eyebrow="During the call · unbound (Path 3)"
          title="Not linked to a deal"
          description="When a call was started without an opportunity (launch Path 3), the overlay coaches as normal but makes the trade-off explicit: with no bound deal, there's nowhere to write the call back when it ends."
        >
          <UnboundOverlay />
        </MockSection>

        <MockSection
          eyebrow="After the call"
          title="Processing & handoff"
          description="When the rep hangs up, the co-pilot processes the transcript and posts it back to the opportunity as an activity — then the confirmation hands the rep back to the web app to see the re-scored deal."
        >
          <PostCallProcessingOverlay />
          <PostCallConfirmedOverlay />
        </MockSection>

        {/* Flags carried forward to the real desktop build. */}
        <Paper withBorder radius="md" p="lg">
          <Stack gap="md">
            <Group gap="xs" wrap="nowrap">
              <ThemeIcon size={26} radius="md" variant="light" color="yellow">
                <IconFlag size={15} />
              </ThemeIcon>
              <Text fw={600}>Open questions for the desktop build</Text>
            </Group>
            <Stack gap="sm">
              <div>
                <Text size="sm" fw={600}>
                  Recording consent — [FLAG FOR RUSSELL]
                </Text>
                <Text size="sm" c="dimmed">
                  How and when the rep — and the buyer — consent to the call
                  being transcribed needs a product and legal decision before
                  the desktop app ships.
                </Text>
              </div>
              <div>
                <Text size="sm" fw={600}>
                  Live script rewrite — [FLAG]
                </Text>
                <Text size="sm" c="dimmed">
                  Whether the overlay rewrites the call script in real time as
                  the conversation drifts is unscoped — MVP capability or a
                  fast-follow.
                </Text>
              </div>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
