import { Button, Center, Paper, Skeleton, Stack, Text } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconRefresh,
  IconUsers,
  IconUserSearch,
} from '@tabler/icons-react';

// --- Loading ---------------------------------------------------------------

export function BuyersLoading() {
  return (
    <Stack gap="xs">
      <Skeleton height={36} radius="sm" />
      {Array.from({ length: 8 }).map((_, row) => (
        <Skeleton key={row} height={48} radius="sm" />
      ))}
    </Stack>
  );
}

// --- Error -----------------------------------------------------------------

export function BuyersError({ onRetry }: { onRetry: () => void }) {
  return (
    <Center py="xl">
      <Paper withBorder p="xl" radius="md" maw={460}>
        <Stack align="center" gap="sm">
          <IconAlertTriangle size={32} color="var(--mantine-color-red-6)" />
          <Text fw={600}>We couldn't load your buyers</Text>
          <Text size="sm" c="dimmed" ta="center">
            Something went wrong fetching your buyers directory. Refresh to try again.
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

// --- Empty (no buyers in the workspace at all) -----------------------------

export function BuyersEmpty() {
  return (
    <Center py="xl">
      <Paper withBorder p="xl" radius="md" maw={480}>
        <Stack align="center" gap="sm">
          <IconUsers size={36} color="var(--mantine-color-dimmed)" />
          <Text fw={600}>No buyers yet</Text>
          <Text size="sm" c="dimmed" ta="center">
            Buyers are the people you sell to. They appear here as you add opportunities and import
            your pipeline — then you can assign a product to anyone still waiting to start tracking
            them on your workbench.
          </Text>
        </Stack>
      </Paper>
    </Center>
  );
}

// --- Unassigned filter, nothing pending (PG-208) ---------------------------

export function BuyersUnassignedEmpty({ onShowAll }: { onShowAll: () => void }) {
  return (
    <Center py="lg">
      <Paper withBorder p="lg" radius="md" maw={460}>
        <Stack align="center" gap="sm">
          <IconCircleCheck size={32} color="var(--mantine-color-teal-6)" />
          <Text fw={600}>No buyers waiting</Text>
          <Text size="sm" c="dimmed" ta="center">
            Everyone has a product and is on your workbench.
          </Text>
          <Button variant="default" size="xs" onClick={onShowAll} mt="xs">
            View all buyers
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}

// --- Filter / search matched nothing ---------------------------------------

export function BuyersFilteredEmpty({
  message,
  onClear,
}: {
  message: string;
  onClear: () => void;
}) {
  return (
    <Center py="lg">
      <Paper withBorder p="lg" radius="md" maw={460}>
        <Stack align="center" gap="sm">
          <IconUserSearch size={28} color="var(--mantine-color-dimmed)" />
          <Text fw={500}>No buyers match</Text>
          <Text size="sm" c="dimmed" ta="center">
            {message}
          </Text>
          <Button variant="default" size="xs" onClick={onClear} mt="xs">
            Clear filters
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
