import { Box, Group, Stack, Text } from '@mantine/core';
import {
  IconBroadcast,
  IconChevronRight,
  IconMinus,
  IconSearch,
} from '@tabler/icons-react';
import { OVERLAY, PICKER_ROWS, type PickerRow } from './mock-data';
import { OverlayWindow, ReadinessGlance } from './overlay-window';

// The desktop app's opportunity picker (M20). When the rep launches the
// co-pilot without a deal already attached — e.g. from the `/copilot` screen's
// Launch button rather than an opportunity header — the app opens here so they
// can bind the call to a deal before it starts. Static design mock: the first
// row is shown in a focused state to make the row affordance legible.

// Two-letter initials from the buyer's name (the part before the " · ").
function initials(buyerLine: string): string {
  const name = buyerLine.split('·')[0]?.trim() ?? '';
  const parts = name.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function PickerRowItem({ row, focused }: { row: PickerRow; focused: boolean }) {
  return (
    <Group
      gap="sm"
      wrap="nowrap"
      px="sm"
      py={9}
      style={{
        background: focused ? OVERLAY.panelBg : 'transparent',
        borderRadius: 10,
      }}
    >
      <Box
        style={{
          width: 30,
          height: 30,
          flexShrink: 0,
          borderRadius: 8,
          background: OVERLAY.headerBg,
          border: `1px solid ${OVERLAY.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text fz={11} fw={700} c={OVERLAY.textSecondary}>
          {initials(row.buyerLine)}
        </Text>
      </Box>

      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text fz={12} fw={600} c={OVERLAY.textPrimary} truncate>
          {row.opportunityName}
        </Text>
        <Text fz={11} c={OVERLAY.textMuted} truncate>
          {row.buyerLine}
        </Text>
      </Box>

      <ReadinessGlance label={row.readinessLabel} dotColor={row.readinessDot} />
      {focused && (
        <IconChevronRight
          size={14}
          color={OVERLAY.textSecondary}
          style={{ flexShrink: 0 }}
        />
      )}
    </Group>
  );
}

// The picker window — wider than the in-call overlay because it's a full
// pre-call surface, not a glanceable coaching card.
export function OpportunityPickerMock() {
  return (
    <OverlayWindow width={420}>
      {/* The app is open but not in a call yet — no recording dot, no timer. */}
      <Group
        justify="space-between"
        wrap="nowrap"
        px="sm"
        py={8}
        style={{
          background: OVERLAY.headerBg,
          borderBottom: `1px solid ${OVERLAY.border}`,
        }}
      >
        <Group gap={6} wrap="nowrap">
          <IconBroadcast size={13} color="var(--mantine-color-indigo-4)" />
          <Text
            fz={10}
            fw={700}
            tt="uppercase"
            lts={0.8}
            c={OVERLAY.textSecondary}
          >
            Live Co-pilot
          </Text>
        </Group>
        <IconMinus size={13} color={OVERLAY.textMuted} />
      </Group>

      <Stack gap="sm" p="sm">
        <div>
          <Text fz={13} fw={600} c={OVERLAY.textPrimary}>
            Which deal is this call about?
          </Text>
          <Text fz={11} c={OVERLAY.textMuted} lh={1.4}>
            The co-pilot loads that deal's pre-call intelligence and saves the
            call back to it when you hang up.
          </Text>
        </div>

        {/* Static stand-in for the search field. */}
        <Group
          gap={7}
          wrap="nowrap"
          px="xs"
          py={7}
          style={{
            border: `1px solid ${OVERLAY.border}`,
            borderRadius: 8,
          }}
        >
          <IconSearch size={13} color={OVERLAY.textMuted} />
          <Text fz={12} c={OVERLAY.textMuted}>
            Search opportunities
          </Text>
        </Group>

        <Stack gap={2}>
          {PICKER_ROWS.map((row, i) => (
            <PickerRowItem
              key={row.opportunityName}
              row={row}
              focused={i === 0}
            />
          ))}
        </Stack>
      </Stack>

      {/* The route into Path 3 — starting a call with no deal bound. */}
      <Group
        justify="center"
        px="sm"
        py={10}
        style={{ borderTop: `1px solid ${OVERLAY.border}` }}
      >
        <Text fz={11} c={OVERLAY.textMuted}>
          or{' '}
          <Text span fz={11} fw={600} c={OVERLAY.textSecondary}>
            start without a deal
          </Text>{' '}
          — coaching only, nothing saved
        </Text>
      </Group>
    </OverlayWindow>
  );
}
