import {
  Alert,
  Box,
  Button,
  Center,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconBriefcase,
  IconFilterOff,
  IconInfoCircle,
  IconPlus,
  IconRefresh,
  IconUpload,
} from '@tabler/icons-react';
import type { WorkbenchView } from './use-workbench-view';

// Shared "what's an opportunity?" explainer — the empty state is a first-time
// user's (and the demo audience's) first encounter with the concept.
const CONCEPT_HEADING = "What's an opportunity?";
const CONCEPT_BODY = [
  "An opportunity is a buyer at a company evaluating your product for a specific deal. It's the unit Pitch Genius diagnoses — pulling evidence from your meetings and notes to score buyer readiness and flag pipeline mismatches.",
  'One buyer can have multiple opportunities over time (current, historical, reframed).',
];

// --- Empty (zero opportunities) -------------------------------------------

interface WorkbenchEmptyProps {
  onAdd: () => void;
  onImport: () => void;
}

export function WorkbenchEmpty({ onAdd, onImport }: WorkbenchEmptyProps) {
  return (
    <Center py="xl">
      <Stack align="center" gap="md" maw={560}>
        <Paper withBorder p="xl" radius="md" w="100%">
          <Stack align="center" gap="sm">
            <IconBriefcase size={36} color="var(--mantine-color-dimmed)" />
            <Title order={3}>Your workbench is empty</Title>
            <Text size="sm" c="dimmed" ta="center">
              Add your first opportunity to get a buyer readiness diagnosis — it'll show up
              here on your board.
            </Text>
            <Button leftSection={<IconPlus size={16} />} onClick={onAdd} mt="sm">
              Add your first opportunity
            </Button>
            <Button
              variant="subtle"
              size="xs"
              color="gray"
              leftSection={<IconUpload size={14} />}
              onClick={onImport}
            >
              Or import your list
            </Button>
          </Stack>
        </Paper>

        <Alert
          icon={<IconInfoCircle size={18} />}
          title={CONCEPT_HEADING}
          color="blue"
          variant="light"
          w="100%"
        >
          <Stack gap="xs">
            {CONCEPT_BODY.map((paragraph) => (
              <Text key={paragraph} size="sm">
                {paragraph}
              </Text>
            ))}
          </Stack>
        </Alert>
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
            Try widening the readiness states or stage, or clear the filters to see
            everything.
          </Text>
          <Button variant="default" size="xs" onClick={onClear} mt="xs">
            Clear filters
          </Button>
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
