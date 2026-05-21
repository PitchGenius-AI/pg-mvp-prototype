import { Button, Center, Paper, Skeleton, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconPlus, IconRefresh, IconScript } from '@tabler/icons-react';

// --- Loading ---------------------------------------------------------------

export function ScriptsLoading() {
  return (
    <Stack gap="md">
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} height={168} radius="md" />
      ))}
    </Stack>
  );
}

// --- Error -----------------------------------------------------------------

export function ScriptsError({ onRetry }: { onRetry: () => void }) {
  return (
    <Center py="xl">
      <Paper withBorder p="xl" radius="md" maw={460}>
        <Stack align="center" gap="sm">
          <IconAlertTriangle size={32} color="var(--mantine-color-red-6)" />
          <Text fw={600}>We couldn't load your call scripts</Text>
          <Text size="sm" c="dimmed" ta="center">
            Something went wrong fetching your scripts. Refresh to try again.
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

// --- Empty (the rep skipped the script step at onboarding) -----------------

export function ScriptsEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <Center py="xl">
      <Paper withBorder p="xl" radius="md" maw={500}>
        <Stack align="center" gap="sm">
          <IconScript size={36} color="var(--mantine-color-dimmed)" />
          <Text fw={600}>No call scripts yet</Text>
          <Text size="sm" c="dimmed" ta="center">
            A call-script template is the talk track you already use. Pitch Genius models the
            pre-call script it generates for each opportunity on your primary template. Add one
            and every generated script gets sharper.
          </Text>
          <Button leftSection={<IconPlus size={16} />} onClick={onAdd} mt="xs">
            Add a script
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
