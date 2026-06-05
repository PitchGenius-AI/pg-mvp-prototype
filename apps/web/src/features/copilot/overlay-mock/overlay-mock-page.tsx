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
import { LiveCopilotDemo } from './live-copilot-demo';
import {
  NudgeOverlay,
  PillOverlay,
  PostCallConfirmedOverlay,
  PostCallProcessingOverlay,
  RestingOverlay,
} from './overlay-states';

// The in-call overlay design-mock showcase (M20, PG-238/239). The overlay is
// part of the Live Co-pilot *desktop app* — explicitly not a web route — so it
// can't be a working screen in this web prototype. This page is the agreed
// substitute: a static gallery of the overlay's states so the client demo can
// show the in-call concept. Reached from `/copilot`; not in the sidebar nav,
// because it isn't an app surface the rep returns to.

// How a call reaches the overlay — the launch paths, named here for context.
// A call is always bound to an opportunity (there is no unbound path), so the
// co-pilot can load pre-call intelligence and save the call back afterwards.
const LAUNCH_PATHS = [
  {
    n: 1,
    title: 'From an opportunity',
    body: 'The rep clicks “Start PG.AI PILOT” in a deal\'s header. The call opens already bound to that buyer — the happy path.',
  },
  {
    n: 2,
    title: 'From the PG.AI PILOT screen',
    body: 'Launching with no deal attached opens the desktop app\'s own opportunity picker, so the rep binds the call to a deal before it starts.',
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

// Same header as MockSection, but renders its children directly — for content
// (like the interactive demo) that brings its own stage.
function MockSectionPlain({ eyebrow, title, description, children }: MockSectionProps) {
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
      {children}
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
              Back to PG.AI PILOT
            </Group>
          </Anchor>
          <Stack gap={2}>
            <Title order={2}>In-call overlay</Title>
            <Text size="sm" c="dimmed">
              What PG.AI PILOT looks like while the rep is on a call —
              live coaching in the deal's matched sales technique.
            </Text>
          </Stack>
        </Stack>

        <Alert
          variant="light"
          color="indigo"
          icon={<IconInfoCircle size={18} />}
          title="An interactive demo of a desktop app"
        >
          <Text size="sm">
            The in-call overlay ships in the PG.AI PILOT desktop app — a
            cross-platform application, not a web page — which floats over your
            call, transcribes live audio, and runs real AI. The demo below
            simulates that experience in the browser: the conversation and
            coaching are scripted, but the flow is real — pick a deal, start the
            call, watch it coach, then end the call and get handed back to the
            opportunity here.
          </Text>
        </Alert>

        {/* --- The interactive demo (hero) -------------------------------- */}
        <MockSectionPlain
          eyebrow="Try it"
          title="PG.AI PILOT — interactive demo"
          description="Search your opportunities and pick who the call is with, then start the call. PG.AI PILOT coaches against a scripted conversation in the deal's matched technique. Drag the window by its title bar, collapse it to a pill, and end the call to see it write back to Pitch Genius."
        >
          <LiveCopilotDemo />
        </MockSectionPlain>

        {/* The launch paths — how a rep gets into the overlay. */}
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

        {/* --- The state gallery ------------------------------------------ */}
        {/* Static, annotated breakdowns of the individual overlay states — the
            interactive demo above runs through them, these label them. */}

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
          description="When PG.AI PILOT notices the rep has skipped something the technique calls for, the prompt escalates: a “Still need to ask” nudge with the missing question, phrased as the next technique move. The planned move folds away beneath it."
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
          eyebrow="After the call"
          title="Processing & handoff"
          description="When the rep hangs up, PG.AI PILOT processes the transcript and posts it back to the opportunity as an activity — then the confirmation hands the rep back to the web app to see the re-scored deal."
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
