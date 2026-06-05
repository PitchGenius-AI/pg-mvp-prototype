import { Badge, Box, Group, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import {
  IconAlertTriangle,
  IconChevronRight,
  IconMinus,
} from '@tabler/icons-react';
import type { PointerEvent, ReactNode } from 'react';
import { OVERLAY, TECHNIQUE_COLOR, TECHNIQUE_LABEL } from './mock-data';

// Shared chrome + primitives for the in-call overlay design mock (M20). Every
// overlay state is built from these pieces so the "window" reads consistently
// across the gallery. The window is always dark — see the note in mock-data.ts
// on why colours are set explicitly here.

// --- The floating window ---------------------------------------------------

interface OverlayWindowProps {
  children: ReactNode;
  // The resting/nudge/unbound/post-call windows are 340px; the picker is wider.
  width?: number;
}

// The desktop app's floating overlay window — compact, rounded, heavily
// elevated so it reads as floating *over* a call rather than sitting in a page.
export function OverlayWindow({ children, width = 340 }: OverlayWindowProps) {
  return (
    <Box
      style={{
        width,
        maxWidth: '100%',
        background: OVERLAY.windowBg,
        border: `1px solid ${OVERLAY.border}`,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow:
          '0 24px 48px -12px rgba(0, 0, 0, 0.55), 0 8px 16px -8px rgba(0, 0, 0, 0.4)',
      }}
    >
      {children}
    </Box>
  );
}

// --- Window header ---------------------------------------------------------

interface OverlayHeaderProps {
  // 'live' shows the recording dot + call timer; 'ended' shows a resting state
  // for the post-call windows.
  mode?: 'live' | 'ended';
  timer?: string;
  // When provided (interactive demo), the collapse control becomes a real
  // button that folds the window down to a pill. Omitted in the static gallery.
  onCollapse?: () => void;
  // When provided, the header acts as the window's drag handle — the demo
  // wires this to its pointer-drag so the rep can move the overlay around.
  onDragStart?: (e: PointerEvent) => void;
}

// The window's top strip: a recording indicator, the product name, the call
// timer, and a collapse control. In the static gallery the collapse control is
// inert; the interactive demo passes `onCollapse`/`onDragStart` to light it up.
export function OverlayHeader({
  mode = 'live',
  timer,
  onCollapse,
  onDragStart,
}: OverlayHeaderProps) {
  const live = mode === 'live';
  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      px="sm"
      py={8}
      onPointerDown={onDragStart}
      style={{
        background: OVERLAY.headerBg,
        borderBottom: `1px solid ${OVERLAY.border}`,
        cursor: onDragStart ? 'grab' : undefined,
        touchAction: onDragStart ? 'none' : undefined,
        userSelect: onDragStart ? 'none' : undefined,
      }}
    >
      <Group gap={6} wrap="nowrap">
        <Box
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: live
              ? 'var(--mantine-color-red-6)'
              : OVERLAY.textMuted,
            flexShrink: 0,
          }}
        />
        <Text
          fz={10}
          fw={700}
          tt="uppercase"
          lts={0.8}
          c={live ? OVERLAY.textSecondary : OVERLAY.textMuted}
        >
          {live ? 'PG.AI PILOT' : 'Call ended'}
        </Text>
      </Group>
      <Group gap={8} wrap="nowrap">
        {timer && (
          <Text fz={11} fw={600} ff="monospace" c={OVERLAY.textSecondary}>
            {timer}
          </Text>
        )}
        {onCollapse ? (
          <UnstyledButton
            onClick={onCollapse}
            // Stop the drag handler on the header from also firing on the button.
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Collapse to a pill"
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <IconMinus size={13} color={OVERLAY.textSecondary} />
          </UnstyledButton>
        ) : (
          <IconMinus size={13} color={OVERLAY.textMuted} />
        )}
      </Group>
    </Group>
  );
}

// --- Readiness glance ------------------------------------------------------

interface GlanceProps {
  label: string;
  dotColor: string;
}

// The quiet, glanceable readiness-state indicator (PG-238) — a state label and
// a small dot. Deliberately never the 0–100 score: in-call, the rep needs a
// direction, not a number to do mental math on.
export function ReadinessGlance({ label, dotColor }: GlanceProps) {
  return (
    <Group gap={5} wrap="nowrap">
      <Box
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
        }}
      />
      <Text fz={11} c={OVERLAY.textSecondary} style={{ whiteSpace: 'nowrap' }}>
        {label}
      </Text>
    </Group>
  );
}

// --- Bound-deal strip ------------------------------------------------------

interface DealStripProps {
  opportunityName: string;
  buyerLine: string;
  readinessLabel: string;
  readinessDot: string;
}

// The sub-header that names the deal the call is bound to, with the readiness
// glance on the right.
export function DealStrip({
  opportunityName,
  buyerLine,
  readinessLabel,
  readinessDot,
}: DealStripProps) {
  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      gap="sm"
      px="sm"
      py={8}
      style={{ borderBottom: `1px solid ${OVERLAY.border}` }}
    >
      <Box style={{ minWidth: 0 }}>
        <Text fz={12} fw={600} c={OVERLAY.textPrimary} truncate>
          {opportunityName}
        </Text>
        <Text fz={11} c={OVERLAY.textMuted} truncate>
          {buyerLine}
        </Text>
      </Box>
      <ReadinessGlance label={readinessLabel} dotColor={readinessDot} />
    </Group>
  );
}

// --- Prompt card -----------------------------------------------------------

interface PromptCardProps {
  // 'resting' is the in-call hero (one calm next move); 'nudge' is the
  // attention state when the rep has skipped something.
  tone: 'resting' | 'nudge';
  techniqueMove: string;
  why: string;
  say: string;
}

// The in-call hero (PG-238): a single prompt card in the matched technique.
// Resting and nudge share a shape so the rep's eye lands in the same place —
// the nudge just escalates the framing and the accent colour.
export function PromptCard({ tone, techniqueMove, why, say }: PromptCardProps) {
  const nudge = tone === 'nudge';
  const accent = nudge
    ? 'var(--mantine-color-yellow-5)'
    : `var(--mantine-color-${TECHNIQUE_COLOR}-4)`;

  return (
    <Box
      style={{
        background: OVERLAY.panelBg,
        borderRadius: 12,
        borderLeft: `3px solid ${accent}`,
      }}
      p="sm"
    >
      <Stack gap={8}>
        {nudge ? (
          <Group gap={5} wrap="nowrap">
            <IconAlertTriangle size={13} color={accent} />
            <Text fz={10} fw={700} tt="uppercase" lts={0.8} c={accent}>
              Still need to ask
            </Text>
            <Text fz={10} c={OVERLAY.textMuted}>
              · {TECHNIQUE_LABEL} · {techniqueMove}
            </Text>
          </Group>
        ) : (
          <Group gap={6} wrap="nowrap">
            <Badge
              size="xs"
              radius="sm"
              variant="filled"
              color={TECHNIQUE_COLOR}
            >
              {TECHNIQUE_LABEL}
            </Badge>
            <Text fz={10} fw={600} tt="uppercase" lts={0.6} c={OVERLAY.textMuted}>
              {techniqueMove}
            </Text>
          </Group>
        )}

        <Text fz={12} c={OVERLAY.textSecondary} lh={1.45}>
          {why}
        </Text>

        <Box
          style={{
            background: OVERLAY.windowBg,
            borderRadius: 8,
            borderLeft: `2px solid ${accent}`,
          }}
          px="xs"
          py={8}
        >
          <Text fz={9} fw={700} tt="uppercase" lts={0.8} c={OVERLAY.textMuted} mb={3}>
            Say this
          </Text>
          <Text fz={13} c={OVERLAY.textPrimary} lh={1.5}>
            “{say}”
          </Text>
        </Box>
      </Stack>
    </Box>
  );
}

// --- Collapsed affordance row ----------------------------------------------

interface CollapsedRowProps {
  icon: ReactNode;
  label: string;
  meta: string;
}

// One of the collapsed affordances under the resting prompt (PG-238) — script
// and questions stay folded away so the resting overlay shows exactly one
// thing. Non-functional: the chevron implies expansion that the mock can't do.
export function CollapsedRow({ icon, label, meta }: CollapsedRowProps) {
  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      px="xs"
      py={7}
      style={{
        borderRadius: 8,
        border: `1px solid ${OVERLAY.border}`,
      }}
    >
      <Group gap={7} wrap="nowrap">
        <ThemeIcon size={18} radius="sm" variant="transparent" c={OVERLAY.textMuted}>
          {icon}
        </ThemeIcon>
        <Text fz={12} fw={600} c={OVERLAY.textSecondary}>
          {label}
        </Text>
      </Group>
      <Group gap={4} wrap="nowrap">
        <Text fz={11} c={OVERLAY.textMuted}>
          {meta}
        </Text>
        <IconChevronRight size={13} color={OVERLAY.textMuted} />
      </Group>
    </Group>
  );
}