import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Code,
  Group,
  Paper,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconClipboardCopy,
  IconCopy,
  IconDownload,
  IconFileText,
  IconMail,
} from '@tabler/icons-react';
import {
  buildCrmNote,
  buildCrmNoteImportFile,
  downloadTextFile,
  exportTier,
  safeFilenameSlug,
} from '../../lib/exports';
import { relativeTime } from '../../lib/relative-time';
import { useExportTimestamp, useRecordExport } from '../../mock/hooks';
import type { MockBuyer, MockDiagnosis, MockOpportunity } from '../../mock/types';
import type { ReadinessVm } from './badges';

interface ExportTabProps {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
  diagnosis: MockDiagnosis | null;
  vm: ReadinessVm;
}

// The Export tab (M17, PG-226) — a note-based, two-tier per-opportunity export.
// The note is always copyable; it downloads as a CRM-ingestible import file only
// when the deal carries a CRM Record ID. Export is pure bookkeeping: it records
// a timestamp and never mutates readiness, stage, or outcome.
export function ExportTab({ opportunity, buyer, diagnosis, vm }: ExportTabProps) {
  const tier = exportTier(opportunity);
  const note = buildCrmNote({ opportunity, buyer, diagnosis });
  const { data: lastExported } = useExportTimestamp(opportunity.id);
  const { mutate: recordExport } = useRecordExport();

  return (
    <Stack gap="md">
      <TierBanner tier={tier} recordId={opportunity.crmRecordId} />

      <CrmNoteCard
        note={note}
        opportunity={opportunity}
        tier={tier}
        lastExported={lastExported ?? null}
        onExported={() => recordExport(opportunity.id)}
      />

      <FollowUpEmailCard diagnosis={diagnosis} isProvisional={vm.isProvisional} />
    </Stack>
  );
}

function TierBanner({
  tier,
  recordId,
}: {
  tier: ReturnType<typeof exportTier>;
  recordId: string | null;
}) {
  if (tier === 'crm_import') {
    return (
      <Alert color="teal" variant="light" icon={<IconDownload size={18} />} p="sm">
        <Text size="sm">
          <Text span fw={600}>
            CRM note import.
          </Text>{' '}
          This deal carries a CRM Record ID ({recordId}), so the note downloads as a
          file your CRM can ingest directly — or copy it by hand.
        </Text>
      </Alert>
    );
  }
  return (
    <Alert color="gray" variant="light" icon={<IconClipboardCopy size={18} />} p="sm">
      <Text size="sm">
        <Text span fw={600}>
          Copy-only.
        </Text>{' '}
        This deal has no CRM Record ID, so the note can&rsquo;t be matched to a CRM
        record automatically. Copy it and paste it into your CRM activity log. Re-importing
        the deal with a Record ID via the Daily Workbench import unlocks file download.
      </Text>
    </Alert>
  );
}

function CrmNoteCard({
  note,
  opportunity,
  tier,
  lastExported,
  onExported,
}: {
  note: string;
  opportunity: MockOpportunity;
  tier: ReturnType<typeof exportTier>;
  lastExported: string | null;
  onExported: () => void;
}) {
  const clipboard = useClipboard({ timeout: 2000 });
  const slug = safeFilenameSlug(opportunity.opportunityName);
  const canDownload = tier === 'crm_import';

  const copy = () => {
    clipboard.copy(note);
    onExported();
    notifications.show({
      color: 'teal',
      title: 'Note copied',
      message: 'CRM note copied to clipboard.',
    });
  };

  const download = () => {
    downloadTextFile(
      `${slug}-crm-note.csv`,
      buildCrmNoteImportFile({ opportunity, note }),
      'text/csv',
    );
    onExported();
    notifications.show({
      color: 'teal',
      title: 'Import file downloaded',
      message: `${slug}-crm-note.csv`,
    });
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs">
            <IconFileText size={18} />
            <Text fw={600}>CRM note</Text>
          </Group>
          {lastExported && (
            <Text size="xs" c="dimmed">
              Last exported {relativeTime(lastExported)}
            </Text>
          )}
        </Group>
        <Text size="xs" c="dimmed">
          One human-readable note summarizing this deal&rsquo;s readiness — built to drop
          straight into your CRM&rsquo;s activity log.
        </Text>

        <Code block style={{ whiteSpace: 'pre-wrap', maxHeight: 360, overflow: 'auto' }}>
          {note}
        </Code>

        <Group gap="sm">
          <Button
            leftSection={clipboard.copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            onClick={copy}
            variant={clipboard.copied ? 'light' : 'filled'}
            color={clipboard.copied ? 'teal' : undefined}
          >
            {clipboard.copied ? 'Copied' : 'Copy note'}
          </Button>
          {canDownload ? (
            <Button
              variant="default"
              leftSection={<IconDownload size={16} />}
              onClick={download}
            >
              Download import file
            </Button>
          ) : (
            <Tooltip
              multiline
              w={260}
              label="No CRM Record ID on this deal — the note can't be matched to a CRM record, so there's nothing to import. Copy it instead."
            >
              <Button variant="default" leftSection={<IconDownload size={16} />} disabled>
                Download import file
              </Button>
            </Tooltip>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}

function FollowUpEmailCard({
  diagnosis,
  isProvisional,
}: {
  diagnosis: MockDiagnosis | null;
  isProvisional: boolean;
}) {
  const clipboard = useClipboard({ timeout: 2000 });
  const subject = diagnosis?.followUpSubject ?? null;
  const body = diagnosis?.followUpBody ?? null;

  if (!subject || !body) {
    return (
      <Paper withBorder p="md" radius="md">
        <Group gap="xs" mb={4}>
          <IconMail size={18} color="var(--mantine-color-dimmed)" />
          <Text fw={600}>Follow-up email</Text>
        </Group>
        <Text size="sm" c="dimmed">
          {isProvisional
            ? 'A follow-up email is drafted with the first diagnosis. Add an activity to generate one.'
            : 'No follow-up email on the latest diagnosis.'}
        </Text>
      </Paper>
    );
  }

  const copy = () => {
    clipboard.copy(`Subject: ${subject}\n\n${body}`);
    notifications.show({
      color: 'teal',
      title: 'Email copied',
      message: 'Follow-up email copied to clipboard.',
    });
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <IconMail size={18} color="var(--mantine-color-blue-7)" />
            <Text fw={600}>Follow-up email</Text>
            <Badge size="xs" variant="light" color="gray">
              Draft
            </Badge>
          </Group>
          <Tooltip label={clipboard.copied ? 'Copied!' : 'Copy email'}>
            <ActionIcon variant="subtle" onClick={copy} aria-label="Copy follow-up email">
              {clipboard.copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            </ActionIcon>
          </Tooltip>
        </Group>
        <Text size="xs" c="dimmed">
          Send this to the buyer — separate from the CRM note above.
        </Text>
        <Text size="sm" fw={500}>
          {subject}
        </Text>
        <Code block style={{ whiteSpace: 'pre-wrap' }}>
          {body}
        </Code>
      </Stack>
    </Paper>
  );
}
