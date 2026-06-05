import { Box, Button, Center, Group, Paper, Skeleton, Stack, Text, Title } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCalendarOff,
  IconFilterOff,
  IconRefresh,
  IconUpload,
} from '@tabler/icons-react';
import { PERIOD_LABELS, type WorkbenchPeriod } from '../../lib/period';
import { DailyLoopSteps, DAILY_LOOP_NOTE } from './daily-loop';
import type { WorkbenchView } from './use-workbench-view';

// --- Empty (zero opportunities) -------------------------------------------

interface WorkbenchEmptyProps {
  // Primary path: the morning Daily Workbench import — the daily ritual we teach.
  onImport: () => void;
  // Secondary, low-commitment path: add a single opportunity via the form.
  onAddOne: () => void;
}

// The product's primary teaching moment (PG-264). The empty state isn't "you
// have nothing yet" — it teaches the daily cadence the whole product is built
// around (morning import → work → end-of-day export). Bulk import leads; the
// single-add is demoted to a "just try it" path.
export function WorkbenchEmpty({ onImport, onAddOne }: WorkbenchEmptyProps) {
  return (
    <Center py="xl">
      <Stack align="center" gap="lg" maw={820} w="100%">
        <Stack align="center" gap={4}>
          <Title order={2} ta="center">
            Here's how each day works
          </Title>
          <Text size="sm" c="dimmed" ta="center" maw={620}>
            Pitch Genius fits around your sales day. Bring in the deals you're working each morning,
            work them with live buyer intelligence, then push your updates back to your CRM before
            you log off.
          </Text>
        </Stack>

        <DailyLoopSteps />

        <Text size="sm" c="dimmed" ta="center" fs="italic">
          {DAILY_LOOP_NOTE}
        </Text>

        <Group justify="center" gap="sm">
          <Button leftSection={<IconUpload size={16} />} onClick={onImport}>
            Import today's leads
          </Button>
          <Button variant="subtle" color="gray" onClick={onAddOne}>
            Just add one opportunity to try it
          </Button>
        </Group>
      </Stack>
    </Center>
  );
}

// --- Filtered to zero ------------------------------------------------------

export function WorkbenchFilteredEmpty({ onClear }: { onClear: () => void }) {
  return (
    <Center py="lg">
      <Paper withBorder p="lg" radius="md" maw={480}>
        <Stack align="center" gap="sm">
          <IconFilterOff size={28} color="var(--mantine-color-dimmed)" />
          <Text fw={500}>No opportunities match these filters</Text>
          <Text size="sm" c="dimmed" ta="center">
            Try widening the readiness states or stage, or clear the filters to see everything.
          </Text>
          <Button variant="default" size="xs" onClick={onClear} mt="xs">
            Clear filters
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}

// --- Empty for the selected period -----------------------------------------

interface WorkbenchPeriodEmptyProps {
  period: WorkbenchPeriod;
  onShowAll: () => void;
  onImport: () => void;
}

// Shown when the rep has opportunities but none fall in the selected recency
// scope (e.g. the default "Today" before the morning import, or for a rep who
// works ad-hoc). Keeps the daily-loop nudge front-and-centre while offering an
// instant escape hatch to the full list.
export function WorkbenchPeriodEmpty({ period, onShowAll, onImport }: WorkbenchPeriodEmptyProps) {
  const label = PERIOD_LABELS[period].toLowerCase();
  return (
    <Center py="lg">
      <Paper withBorder p="lg" radius="md" maw={480}>
        <Stack align="center" gap="sm">
          <IconCalendarOff size={28} color="var(--mantine-color-dimmed)" />
          <Text fw={500}>Nothing worked {label}</Text>
          <Text size="sm" c="dimmed" ta="center">
            None of your deals were imported, added, or worked {label}. Import today's leads to
            start the day, or show every deal.
          </Text>
          <Group gap="sm" mt="xs">
            <Button size="xs" leftSection={<IconUpload size={15} />} onClick={onImport}>
              Import today's leads
            </Button>
            <Button variant="default" size="xs" onClick={onShowAll}>
              Show all
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Center>
  );
}

// --- Error -----------------------------------------------------------------

export function WorkbenchError({ onRetry }: { onRetry: () => void }) {
  return (
    <Center py="xl">
      <Paper withBorder p="xl" radius="md" maw={460}>
        <Stack align="center" gap="sm">
          <IconAlertTriangle size={32} color="var(--mantine-color-red-6)" />
          <Text fw={600}>We couldn't load your opportunities</Text>
          <Text size="sm" c="dimmed" ta="center">
            Something went wrong fetching your workbench. Refresh to try again.
          </Text>
          <Button
            leftSection={<IconRefresh size={15} />}
            variant="default"
            onClick={onRetry}
            mt="xs"
          >
            Refresh
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}

// --- Loading ---------------------------------------------------------------

export function WorkbenchLoading({ view }: { view: WorkbenchView }) {
  return view === 'list' ? <ListSkeleton /> : <BoardSkeleton />;
}

function BoardSkeleton() {
  return (
    <Group align="flex-start" gap="md" wrap="nowrap" style={{ overflow: 'hidden' }}>
      {Array.from({ length: 4 }).map((_, col) => (
        <Box key={col} w={300} style={{ flexShrink: 0 }}>
          <Skeleton height={14} width="55%" mb={10} />
          <Stack gap="sm">
            {Array.from({ length: col === 0 ? 3 : 2 }).map((__, card) => (
              <Skeleton key={card} height={132} radius="md" />
            ))}
          </Stack>
        </Box>
      ))}
    </Group>
  );
}

function ListSkeleton() {
  return (
    <Stack gap="xs">
      <Skeleton height={36} radius="sm" />
      {Array.from({ length: 7 }).map((_, row) => (
        <Skeleton key={row} height={52} radius="sm" />
      ))}
    </Stack>
  );
}
