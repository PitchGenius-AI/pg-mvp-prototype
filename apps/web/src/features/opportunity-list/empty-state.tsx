import { Button, Center, Paper, Stack, Text, Title } from '@mantine/core';
import { IconBriefcase, IconFilterOff, IconPlus } from '@tabler/icons-react';

// First-time / truly-empty: no opps and no filters active.
interface NoOpportunitiesProps {
  onAdd: () => void;
}

export function NoOpportunitiesEmpty({ onAdd }: NoOpportunitiesProps) {
  return (
    <Center py="xl">
      <Paper withBorder p="xl" radius="md" maw={520}>
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
