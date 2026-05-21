import { Button, Center, Paper, Skeleton, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconBox, IconRefresh } from '@tabler/icons-react';

// --- Loading ---------------------------------------------------------------

export function ProductsLoading() {
  return (
    <Stack gap="md">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} height={148} radius="md" />
      ))}
    </Stack>
  );
}

// --- Error -----------------------------------------------------------------

export function ProductsError({ onRetry }: { onRetry: () => void }) {
  return (
    <Center py="xl">
      <Paper withBorder p="xl" radius="md" maw={460}>
        <Stack align="center" gap="sm">
          <IconAlertTriangle size={32} color="var(--mantine-color-red-6)" />
          <Text fw={600}>We couldn't load your products</Text>
          <Text size="sm" c="dimmed" ta="center">
            Something went wrong fetching your products. Refresh to try again.
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

// --- Empty (defensive — onboarding always creates a first product) ---------

export function ProductsEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <Center py="xl">
      <Paper withBorder p="xl" radius="md" maw={480}>
        <Stack align="center" gap="sm">
          <IconBox size={36} color="var(--mantine-color-dimmed)" />
          <Text fw={600}>No products yet</Text>
          <Text size="sm" c="dimmed" ta="center">
            Products are what you sell. Every readiness diagnosis is anchored to a product's
            context — add your first one to get started.
          </Text>
          <Button onClick={onAdd} mt="xs">
            Add product
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
