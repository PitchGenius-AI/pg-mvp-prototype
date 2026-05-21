import { Alert, Button, Center, Loader, Paper, Skeleton, Stack, Text } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconFileExport,
  IconRefresh,
} from '@tabler/icons-react';

// --- Loading ---------------------------------------------------------------

export function ExportPackLoading() {
  return (
    <Stack gap="sm">
      <Skeleton height={40} radius="sm" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} height={92} radius="md" />
      ))}
    </Stack>
  );
}

// --- Error -----------------------------------------------------------------

export function ExportPackError({ onRetry }: { onRetry: () => void }) {
  return (
    <Center py="xl">
      <Paper withBorder p="xl" radius="md" maw={460}>
        <Stack align="center" gap="sm">
          <IconAlertTriangle size={32} color="var(--mantine-color-red-6)" />
          <Text fw={600}>We couldn't assemble your update pack</Text>
          <Text size="sm" c="dimmed" ta="center">
            Something went wrong gathering the day's deals. Refresh to try again.
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

// --- Empty (no opportunity has any buyer activity) -------------------------

export function ExportPackEmpty({
  onImportActivity,
  onWorkbench,
}: {
  onImportActivity: () => void;
  onWorkbench: () => void;
}) {
  return (
    <Center py="xl">
      <Paper withBorder p="xl" radius="md" maw={520}>
        <Stack align="center" gap="sm">
          <IconFileExport size={36} color="var(--mantine-color-dimmed)" />
          <Text fw={600}>Nothing to export yet</Text>
          <Text size="sm" c="dimmed" ta="center">
            The CRM Update Pack collects deals with logged buyer activity and turns each into a note
            for your CRM. None of your opportunities have activity yet — add a call, email, or note,
            or import your activity history, and they'll show up here.
          </Text>
          <Button onClick={onImportActivity} mt="xs">
            Import activity history
          </Button>
          <Button variant="subtle" size="xs" color="gray" onClick={onWorkbench}>
            Back to workbench
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}

// --- Generating (the pack file is being assembled) ------------------------

export function ExportPackGenerating({ count }: { count: number }) {
  return (
    <Center py={64}>
      <Stack align="center" gap="sm">
        <Loader size="lg" />
        <Text fw={600}>Assembling your update pack…</Text>
        <Text size="sm" c="dimmed" ta="center">
          Generating {count} CRM {count === 1 ? 'note' : 'notes'} from the latest buyer evidence.
        </Text>
      </Stack>
    </Center>
  );
}

// --- Caught up (nothing new since the last export) ------------------------

// Inline banner — shown in place of the "showing activity since…" line when no
// deal has new activity since the rep last exported (PG-232).
export function ExportPackCaughtUp({ lastExportLabel }: { lastExportLabel: string | null }) {
  return (
    <Alert color="teal" variant="light" icon={<IconCircleCheck size={18} />} p="sm">
      <Text size="sm">
        <Text span fw={600}>
          You're all caught up.
        </Text>{' '}
        No deal has new buyer activity
        {lastExportLabel ? ` since your last export ${lastExportLabel}` : ''}. You can still
        re-export a deal below if you need to.
      </Text>
    </Alert>
  );
}
