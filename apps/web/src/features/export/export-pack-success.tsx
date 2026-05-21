import {
  Alert,
  Button,
  Center,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCheck,
  IconCircleCheck,
  IconClipboardCopy,
  IconCopy,
  IconInfoCircle,
} from '@tabler/icons-react';
import type { ExportPackRow } from '../../mock/export-pack-rows';
import { useRecordExport } from '../../mock/hooks';

// One copy-only deal carried out of a pack download — it has no Record ID, so
// it never made it into the import file and the rep copies its note by hand.
export interface PackCopyOnlyEntry {
  row: ExportPackRow;
  note: string;
}

export interface PackResult {
  // The downloaded file's name — null when every selected deal was copy-only,
  // so there was no file to download (PG-232).
  filename: string | null;
  noteCount: number;
  copyOnly: PackCopyOnlyEntry[];
  failedCount: number;
  crmLabel: string;
}

interface ExportPackSuccessProps {
  result: PackResult;
  onDone: () => void;
  onWorkbench: () => void;
}

// The post-download confirmation (M18, PG-232). Export is bookkeeping — it
// stamps each exported deal and never touches readiness, stage, or outcome — so
// the panel's job is to remind the rep the file still has to be imported into
// their CRM, and to surface any copy-only deals that the file left out.
export function ExportPackSuccess({ result, onDone, onWorkbench }: ExportPackSuccessProps) {
  const hasFile = result.filename !== null && result.noteCount > 0;

  return (
    <Center py="xl">
      <Paper withBorder radius="md" p="xl" maw={620} w="100%">
        <Stack gap="md">
          <Stack align="center" gap="sm">
            <ThemeIcon color="teal" variant="light" size={56} radius="xl">
              <IconCircleCheck size={32} />
            </ThemeIcon>
            <Text fw={600} fz="lg">
              {hasFile ? 'Update pack downloaded' : 'Notes ready to copy'}
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              {hasFile ? (
                <>
                  {result.noteCount} CRM {result.noteCount === 1 ? 'note' : 'notes'} saved to{' '}
                  <Text span fw={600}>
                    {result.filename}
                  </Text>
                  .
                </>
              ) : (
                <>
                  No CRM Record IDs on the selected deals, so there's no import file — copy each
                  note below into your CRM by hand.
                </>
              )}
            </Text>
          </Stack>

          {hasFile && (
            <Alert color="blue" variant="light" icon={<IconInfoCircle size={18} />}>
              <Text size="sm">
                <Text span fw={600}>
                  The file isn't in your CRM yet.
                </Text>{' '}
                Open {result.crmLabel} and import{' '}
                <Text span fw={600}>
                  {result.filename}
                </Text>{' '}
                to attach these notes to their deals. Pitch Genius doesn't write to your CRM — it
                stays your system of record.
              </Text>
            </Alert>
          )}

          {result.failedCount > 0 && (
            <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />}>
              {result.failedCount} {result.failedCount === 1 ? 'note' : 'notes'} couldn't be
              generated and {result.failedCount === 1 ? 'was' : 'were'} left out of the pack. Their
              deals are unchanged — try exporting them again.
            </Alert>
          )}

          {result.copyOnly.length > 0 && (
            <Stack gap="xs">
              <Divider
                label={
                  <Group gap={6}>
                    <IconClipboardCopy size={14} />
                    <span>
                      {result.copyOnly.length} copy-only{' '}
                      {result.copyOnly.length === 1 ? 'deal' : 'deals'} — not in the file
                    </span>
                  </Group>
                }
                labelPosition="left"
              />
              <Text size="xs" c="dimmed">
                These deals have no CRM Record ID, so they can't be matched to a record
                automatically. Copy each note into your CRM activity log by hand.
              </Text>
              {result.copyOnly.map((entry) => (
                <CopyOnlyItem key={entry.row.opportunity.id} entry={entry} />
              ))}
            </Stack>
          )}

          <Group justify="flex-end" gap="sm" mt="xs">
            <Button variant="default" onClick={onWorkbench}>
              Back to workbench
            </Button>
            <Button onClick={onDone}>Done</Button>
          </Group>
        </Stack>
      </Paper>
    </Center>
  );
}

function CopyOnlyItem({ entry }: { entry: PackCopyOnlyEntry }) {
  const clipboard = useClipboard({ timeout: 2000 });
  const recordExport = useRecordExport();
  const { buyer, opportunity } = entry.row;
  const buyerName = buyer
    ? [buyer.firstName, buyer.lastName].filter(Boolean).join(' ')
    : 'Unknown buyer';

  const copy = () => {
    clipboard.copy(entry.note);
    recordExport.mutate(opportunity.id);
    notifications.show({
      color: 'teal',
      title: 'Note copied',
      message: `${buyerName} — paste it into your CRM activity log.`,
    });
  };

  return (
    <Paper withBorder radius="sm" p="xs">
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <div style={{ minWidth: 0 }}>
          <Text size="sm" fw={500} truncate>
            {buyerName} · {buyer?.company ?? '—'}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {opportunity.opportunityName}
          </Text>
        </div>
        <Button
          size="xs"
          variant={clipboard.copied ? 'light' : 'default'}
          color={clipboard.copied ? 'teal' : undefined}
          leftSection={clipboard.copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          onClick={copy}
          style={{ flexShrink: 0 }}
        >
          {clipboard.copied ? 'Copied' : 'Copy note'}
        </Button>
      </Group>
    </Paper>
  );
}
