import { Box, Button, Group, Menu, Stack, Text, UnstyledButton } from '@mantine/core';
import {
  IconBroadcast,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconSearch,
} from '@tabler/icons-react';
import type { PointerEvent } from 'react';
import { PERIOD_LABELS, workbenchPeriods, type WorkbenchPeriod } from '../../../lib/period';
import { OVERLAY } from './mock-data';
import { ReadinessGlance } from './overlay-window';

// The desktop app's opportunity picker — the first thing the rep sees when the
// co-pilot launches without a deal already attached. In the interactive demo
// this is a working surface: the rep searches, picks who the call is with, and
// starts the call. (There is intentionally no "start without a deal" path — a
// call is always bound to an opportunity so the co-pilot can save it back.)

export interface PickerRowData {
  // The real opportunity id — used to deep-link back into the web app afterwards.
  id: string;
  buyerName: string;
  company: string;
  role: string;
  readinessLabel: string;
  readinessDot: string;
}

// Two-letter initials from the buyer's name.
function initials(buyerName: string): string {
  const parts = buyerName.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function PickerRowItem({
  row,
  selected,
  onSelect,
}: {
  row: PickerRowData;
  selected: boolean;
  onSelect: () => void;
}) {
  const subtitle = [row.company, row.role].filter(Boolean).join(' · ');
  return (
    <UnstyledButton onClick={onSelect} style={{ width: '100%' }}>
      <Group
        gap="sm"
        wrap="nowrap"
        px="sm"
        py={9}
        style={{
          background: selected ? OVERLAY.panelBg : 'transparent',
          border: `1px solid ${selected ? OVERLAY.border : 'transparent'}`,
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
            {initials(row.buyerName)}
          </Text>
        </Box>

        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text fz={12} fw={600} c={OVERLAY.textPrimary} truncate>
            {row.buyerName}
          </Text>
          <Text fz={11} c={OVERLAY.textMuted} truncate>
            {subtitle}
          </Text>
        </Box>

        <ReadinessGlance label={row.readinessLabel} dotColor={row.readinessDot} />
        {selected && (
          <IconChevronRight size={14} color={OVERLAY.textSecondary} style={{ flexShrink: 0 }} />
        )}
      </Group>
    </UnstyledButton>
  );
}

// A compact, overlay-themed recency scope for the picker — mirrors the
// Workbench's PeriodFilter so the rep narrows the call list to the deals they're
// working today. A dropdown rather than a pill row so it sits inline next to the
// search bar without crowding the narrow window.
function PeriodSelect({
  value,
  onChange,
  counts,
}: {
  value: WorkbenchPeriod;
  onChange: (period: WorkbenchPeriod) => void;
  counts: Record<WorkbenchPeriod, number>;
}) {
  return (
    <Menu position="bottom-end" radius={8} withinPortal shadow="md">
      <Menu.Target>
        <UnstyledButton
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 10px',
            border: `1px solid ${OVERLAY.border}`,
            borderRadius: 8,
            background: OVERLAY.panelBg,
          }}
        >
          <Text fz={12} fw={600} c={OVERLAY.textPrimary} style={{ whiteSpace: 'nowrap' }}>
            {PERIOD_LABELS[value]}
          </Text>
          <Text fz={11} c={OVERLAY.textMuted}>
            {counts[value]}
          </Text>
          <IconChevronDown size={13} color={OVERLAY.textMuted} />
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown
        style={{ background: OVERLAY.windowBg, border: `1px solid ${OVERLAY.border}` }}
      >
        {workbenchPeriods.map((period) => {
          const active = period === value;
          return (
            <Menu.Item
              key={period}
              onClick={() => onChange(period)}
              leftSection={
                active ? (
                  <IconCheck size={13} color="var(--mantine-color-indigo-4)" />
                ) : (
                  <Box style={{ width: 13 }} />
                )
              }
              rightSection={
                <Text fz={11} c={OVERLAY.textMuted}>
                  {counts[period]}
                </Text>
              }
              style={{ background: 'transparent' }}
            >
              <Text
                fz={12}
                fw={active ? 700 : 500}
                c={active ? OVERLAY.textPrimary : OVERLAY.textSecondary}
              >
                {PERIOD_LABELS[period]}
              </Text>
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}

interface OpportunityPickerProps {
  rows: PickerRowData[];
  query: string;
  onQueryChange: (query: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStart: () => void;
  // Recency scope — defaults to Today, the day's call list.
  period: WorkbenchPeriod;
  onPeriodChange: (period: WorkbenchPeriod) => void;
  periodCounts: Record<WorkbenchPeriod, number>;
  // True when "Today" was empty so the list fell back to showing all deals.
  usingFallback: boolean;
  // Header acts as the drag handle in the demo stage.
  onDragStart?: (e: PointerEvent) => void;
}

// The picker window — wider than the in-call overlay because it's a full
// pre-call surface, not a glanceable coaching card.
export function OpportunityPicker({
  rows,
  query,
  onQueryChange,
  selectedId,
  onSelect,
  onStart,
  period,
  onPeriodChange,
  periodCounts,
  usingFallback,
  onDragStart,
}: OpportunityPickerProps) {
  return (
    <Box
      style={{
        width: 420,
        maxWidth: '100%',
        background: OVERLAY.windowBg,
        border: `1px solid ${OVERLAY.border}`,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.55), 0 8px 16px -8px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* The app is open but not in a call yet — no recording dot, no timer. */}
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
          <IconBroadcast size={13} color="var(--mantine-color-indigo-4)" />
          <Text fz={10} fw={700} tt="uppercase" lts={0.8} c={OVERLAY.textSecondary}>
            PG.AI PILOT
          </Text>
        </Group>
      </Group>

      <Stack gap="sm" p="sm">
        <div>
          <Text fz={13} fw={600} c={OVERLAY.textPrimary}>
            Who&apos;s going to be on the call?
          </Text>
          <Text fz={11} c={OVERLAY.textMuted} lh={1.4}>
            PG.AI PILOT loads that buyer&apos;s pre-call intelligence and saves the call back to
            their opportunity when you hang up.
          </Text>
        </div>

        <Group gap={7} wrap="nowrap" align="stretch">
          <Group
            gap={7}
            wrap="nowrap"
            px="xs"
            py={7}
            style={{
              flex: 1,
              minWidth: 0,
              border: `1px solid ${OVERLAY.border}`,
              borderRadius: 8,
            }}
          >
            <IconSearch size={13} color={OVERLAY.textMuted} />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.currentTarget.value)}
              placeholder="Search opportunities"
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--mantine-color-gray-0)',
                fontSize: 12,
              }}
            />
          </Group>
          <PeriodSelect value={period} onChange={onPeriodChange} counts={periodCounts} />
        </Group>
        {usingFallback && (
          <Text fz={10} c={OVERLAY.textMuted}>
            No calls {PERIOD_LABELS[period].toLowerCase()} — showing all your deals.
          </Text>
        )}

        <Stack gap={2} style={{ maxHeight: 220, overflowY: 'auto' }}>
          {rows.length === 0 ? (
            <Text fz={12} c={OVERLAY.textMuted} ta="center" py="md">
              No opportunities match “{query}”.
            </Text>
          ) : (
            rows.map((row) => (
              <PickerRowItem
                key={row.id}
                row={row}
                selected={row.id === selectedId}
                onSelect={() => onSelect(row.id)}
              />
            ))
          )}
        </Stack>
      </Stack>

      <Group
        justify="flex-end"
        px="sm"
        py={10}
        style={{ borderTop: `1px solid ${OVERLAY.border}` }}
      >
        <Button
          size="xs"
          radius="md"
          color="indigo"
          leftSection={<IconBroadcast size={14} />}
          disabled={selectedId === null}
          onClick={onStart}
        >
          Start call
        </Button>
      </Group>
    </Box>
  );
}
