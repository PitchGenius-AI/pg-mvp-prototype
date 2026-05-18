import { Alert, Button, Center, Paper, Stack, Text, Title } from '@mantine/core';
import { IconBriefcase, IconFilterOff, IconInfoCircle, IconPlus } from '@tabler/icons-react';
import {
  OPPORTUNITY_CONCEPT_BODY,
  OPPORTUNITY_CONCEPT_HEADING,
} from './opportunity-concept-copy';

// First-time / truly-empty: no opps and no filters active.
interface NoOpportunitiesProps {
  onAdd: () => void;
}

export function NoOpportunitiesEmpty({ onAdd }: NoOpportunitiesProps) {
  return (
    <Center py="xl">
      <Stack align="center" gap="md" maw={560}>
        <Paper withBorder p="xl" radius="md" w="100%">
          <Stack align="center" gap="sm">
            <IconBriefcase size={36} color="var(--mantine-color-dimmed)" />
            <Title order={3}>No opportunities yet</Title>
            <Text size="sm" c="dimmed" ta="center">
              Add your first opportunity to get a buyer readiness diagnosis.
            </Text>
            <Button leftSection={<IconPlus size={16} />} onClick={onAdd} mt="sm">
              Add opportunity
            </Button>
          </Stack>
        </Paper>

        <Alert
          icon={<IconInfoCircle size={18} />}
          title={OPPORTUNITY_CONCEPT_HEADING}
          color="blue"
          variant="light"
          w="100%"
        >
          <Stack gap="xs">
            {OPPORTUNITY_CONCEPT_BODY.map((paragraph) => (
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

// Filtered-to-zero: opps exist but current filters return nothing.
interface FilteredEmptyProps {
  onClearFilters: () => void;
}

export function FilteredEmpty({ onClearFilters }: FilteredEmptyProps) {
  return (
    <Center py="lg">
      <Paper withBorder p="lg" radius="md" maw={520}>
        <Stack align="center" gap="sm">
          <IconFilterOff size={28} color="var(--mantine-color-dimmed)" />
          <Text fw={500}>No opportunities match these filters</Text>
          <Text size="sm" c="dimmed" ta="center">
            Try widening the readiness states, switching alignment, or turning off the
            at-risk toggle.
          </Text>
          <Button variant="default" size="xs" onClick={onClearFilters} mt="xs">
            Clear all filters
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
