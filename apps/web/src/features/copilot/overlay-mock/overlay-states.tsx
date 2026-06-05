import { Box, Button, Group, Loader, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconArrowRight,
  IconArrowUpRight,
  IconCheck,
  IconCircleCheck,
  IconHelpCircle,
  IconScript,
} from '@tabler/icons-react';
import {
  BOUND_DEAL,
  NUDGE_PROMPT,
  OVERLAY,
  RESTING_PROMPT,
  TECHNIQUE_LABEL,
} from './mock-data';
import {
  CollapsedRow,
  DealStrip,
  OverlayHeader,
  OverlayWindow,
  PromptCard,
} from './overlay-window';

// The individual states of the in-call overlay design mock (M20). Each is a
// static composition of the shared chrome — non-functional by design; the real
// behaviour ships with the desktop app. Buttons render as `div`s so the mock
// never looks like it should respond to a click.

// --- PG-238: resting ("the in-call hero") ----------------------------------

// The resting overlay: one prompt card in the matched technique, the readiness
// glance, and the script + questions affordances kept collapsed so exactly one
// thing is asking for the rep's attention mid-call.
export function RestingOverlay() {
  return (
    <OverlayWindow>
      <OverlayHeader mode="live" timer="08:12" />
      <DealStrip
        opportunityName={BOUND_DEAL.opportunityName}
        buyerLine={BOUND_DEAL.buyerLine}
        readinessLabel={BOUND_DEAL.readinessLabel}
        readinessDot={BOUND_DEAL.readinessDot}
      />
      <Stack gap={8} p="sm">
        <PromptCard
          tone="resting"
          techniqueMove={RESTING_PROMPT.techniqueMove}
          why={RESTING_PROMPT.why}
          say={RESTING_PROMPT.say}
        />
        <CollapsedRow
          icon={<IconScript size={14} />}
          label="Call script"
          meta={`${TECHNIQUE_LABEL} · 4 sections`}
        />
        <CollapsedRow
          icon={<IconHelpCircle size={14} />}
          label="Still to ask"
          meta="3 questions"
        />
      </Stack>
    </OverlayWindow>
  );
}

// --- PG-239: missing-question nudge ----------------------------------------

// The nudge state: the overlay caught that the rep covered the problem but
// never made its cost real, and surfaces the missing question. The planned
// resting move folds into a collapsed row beneath it.
export function NudgeOverlay() {
  return (
    <OverlayWindow>
      <OverlayHeader mode="live" timer="14:36" />
      <DealStrip
        opportunityName={BOUND_DEAL.opportunityName}
        buyerLine={BOUND_DEAL.buyerLine}
        readinessLabel={BOUND_DEAL.readinessLabel}
        readinessDot={BOUND_DEAL.readinessDot}
      />
      <Stack gap={8} p="sm">
        <PromptCard
          tone="nudge"
          techniqueMove={NUDGE_PROMPT.techniqueMove}
          why={NUDGE_PROMPT.why}
          say={NUDGE_PROMPT.say}
        />
        <CollapsedRow
          icon={<IconArrowRight size={14} />}
          label="Planned next move"
          meta={`${TECHNIQUE_LABEL} · ${RESTING_PROMPT.techniqueMove}`}
        />
      </Stack>
    </OverlayWindow>
  );
}

// --- PG-239: collapsed pill ------------------------------------------------

// The overlay folded down to a pill — its smallest footprint, for when the rep
// wants the screen back. The badge carries the count of prompts waiting.
export function PillOverlay() {
  return (
    <Box
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: OVERLAY.windowBg,
        border: `1px solid ${OVERLAY.border}`,
        borderRadius: 999,
        padding: '7px 12px',
        boxShadow: '0 12px 28px -8px rgba(0, 0, 0, 0.55)',
      }}
    >
      <Box
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: 'var(--mantine-color-red-6)',
        }}
      />
      <Text fz={12} fw={600} c={OVERLAY.textPrimary}>
        PG.AI PILOT
      </Text>
      <Box
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 16,
          height: 16,
          padding: '0 4px',
          borderRadius: 999,
          background: 'var(--mantine-color-indigo-6)',
        }}
      >
        <Text fz={10} fw={700} c="var(--mantine-color-white)">
          1
        </Text>
      </Box>
    </Box>
  );
}

// --- PG-239: post-call processing ------------------------------------------

interface ProcessStepProps {
  state: 'done' | 'active' | 'pending';
  label: string;
}

function ProcessStep({ state, label }: ProcessStepProps) {
  return (
    <Group gap={8} wrap="nowrap">
      {state === 'done' && (
        <ThemeIcon size={16} radius="xl" variant="filled" color="teal">
          <IconCheck size={10} />
        </ThemeIcon>
      )}
      {state === 'active' && <Loader size={14} color="indigo" />}
      {state === 'pending' && (
        <Box
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: `1.5px solid ${OVERLAY.border}`,
          }}
        />
      )}
      <Text
        fz={12}
        c={state === 'pending' ? OVERLAY.textMuted : OVERLAY.textSecondary}
      >
        {label}
      </Text>
    </Group>
  );
}

// The handoff after the rep ends the call: the co-pilot processes the
// transcript before posting it back to the web app.
export function PostCallProcessingOverlay() {
  return (
    <OverlayWindow>
      <OverlayHeader mode="ended" />
      <Stack gap="sm" p="md">
        <div>
          <Text fz={13} fw={600} c={OVERLAY.textPrimary}>
            Writing this call back to Pitch Genius…
          </Text>
          <Text fz={11} c={OVERLAY.textMuted}>
            {BOUND_DEAL.opportunityName}
          </Text>
        </div>
        <Stack gap={7}>
          <ProcessStep state="done" label="Transcript captured" />
          <ProcessStep state="active" label="Generating the readiness diagnosis" />
          <ProcessStep state="pending" label="Re-scoring the deal" />
        </Stack>
      </Stack>
    </OverlayWindow>
  );
}

// --- PG-239: post-call handoff confirmation --------------------------------

// The confirmation: the call landed on the opportunity as an activity, and the
// "Open in Pitch Genius" affordance is the bridge back to the web app.
export function PostCallConfirmedOverlay() {
  return (
    <OverlayWindow>
      <OverlayHeader mode="ended" />
      <Stack gap="sm" p="md">
        <Group gap={8} wrap="nowrap">
          <ThemeIcon size={28} radius="xl" variant="light" color="teal">
            <IconCircleCheck size={18} />
          </ThemeIcon>
          <div style={{ minWidth: 0 }}>
            <Text fz={13} fw={600} c={OVERLAY.textPrimary}>
              Saved to the opportunity
            </Text>
            <Text fz={11} c={OVERLAY.textMuted} truncate>
              {BOUND_DEAL.opportunityName}
            </Text>
          </div>
        </Group>

        <Box
          style={{ background: OVERLAY.panelBg, borderRadius: 10 }}
          px="sm"
          py={8}
        >
          <Stack gap={5}>
            <Text fz={12} c={OVERLAY.textSecondary}>
              Posted as a video-call activity.
            </Text>
            <Text fz={12} c={OVERLAY.textSecondary}>
              Readiness held at{' '}
              <Text span fz={12} fw={600} c={OVERLAY.textPrimary}>
                {BOUND_DEAL.readinessLabel}
              </Text>{' '}
              — the buyer didn't move.
            </Text>
          </Stack>
        </Box>

        <Button
          component="div"
          size="xs"
          radius="md"
          variant="white"
          color="dark"
          rightSection={<IconArrowUpRight size={13} />}
          style={{ alignSelf: 'flex-start' }}
        >
          Open in Pitch Genius
        </Button>
      </Stack>
    </OverlayWindow>
  );
}
