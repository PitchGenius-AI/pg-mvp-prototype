import { ActionIcon, Button, Code, Group, Paper, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconBraces,
  IconCheck,
  IconCopy,
  IconDownload,
  IconFileSpreadsheet,
  IconFileText,
} from '@tabler/icons-react';
import {
  buildCrmNoteText,
  buildOpportunityJson,
  buildSingleOpportunityCsv,
  downloadTextFile,
  safeFilenameSlug,
} from '../../lib/exports';
import type {
  MockActivity,
  MockBuyer,
  MockDiagnosis,
  MockOpportunity,
} from '../../mock/types';

interface ExportTabProps {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
  diagnosis: MockDiagnosis | null;
  interactions: MockActivity[];
}

export function ExportTab({ opportunity, buyer, diagnosis, interactions }: ExportTabProps) {
  const slug = safeFilenameSlug(opportunity.opportunityName);
  const crmText = buildCrmNoteText({ opportunity, buyer, diagnosis });

  const downloadCsv = () => {
    downloadTextFile(
      `${slug}.csv`,
      buildSingleOpportunityCsv({ opportunity, buyer, diagnosis }),
      'text/csv',
    );
    notifications.show({ color: 'teal', title: 'CSV downloaded', message: `${slug}.csv` });
  };

  const downloadJson = () => {
    downloadTextFile(
      `${slug}.json`,
      buildOpportunityJson({ opportunity, buyer, diagnosis, interactions }),
      'application/json',
    );
    notifications.show({ color: 'teal', title: 'JSON downloaded', message: `${slug}.json` });
  };

  return (
    <Stack gap="md">
      <CrmNoteCard text={crmText} />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <DownloadCard
          title="CSV"
          description="Single-row CSV with opp + buyer + latest diagnosis. Drop into a spreadsheet or your CRM bulk-import tool."
          icon={<IconFileSpreadsheet size={18} color="var(--mantine-color-blue-7)" />}
          onDownload={downloadCsv}
          filename={`${slug}.csv`}
        />
        <DownloadCard
          title="JSON"
          description="Full structured dump: opportunity, buyer, interactions, and the latest diagnosis. Useful for downstream tooling."
          icon={<IconBraces size={18} color="var(--mantine-color-violet-7)" />}
          onDownload={downloadJson}
          filename={`${slug}.json`}
        />
      </SimpleGrid>
    </Stack>
  );
}

function CrmNoteCard({ text }: { text: string }) {
  const clipboard = useClipboard({ timeout: 2000 });
  const copy = () => {
    clipboard.copy(text);
    notifications.show({
      color: 'teal',
      title: 'Copied',
      message: 'CRM note copied to clipboard.',
    });
  };
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <IconFileText size={18} />
            <Text fw={600}>CRM note</Text>
          </Group>
          <Tooltip label={clipboard.copied ? 'Copied!' : 'Copy to clipboard'}>
            <ActionIcon variant="subtle" onClick={copy} aria-label="Copy CRM note">
              {clipboard.copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            </ActionIcon>
          </Tooltip>
        </Group>
        <Text size="xs" c="dimmed">
          Paste straight into your CRM's activity log or note field.
        </Text>
        <Code block style={{ whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto' }}>
          {text}
        </Code>
      </Stack>
    </Paper>
  );
}

interface DownloadCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onDownload: () => void;
  filename: string;
}

function DownloadCard({ title, description, icon, onDownload, filename }: DownloadCardProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="xs">
        <Group gap="xs">
          {icon}
          <Text fw={600}>{title}</Text>
        </Group>
        <Text size="xs" c="dimmed">
          {description}
        </Text>
        <Text size="xs" c="dimmed" fs="italic">
          {filename}
        </Text>
        <Button
          leftSection={<IconDownload size={14} />}
          variant="default"
          size="xs"
          onClick={onDownload}
          mt="xs"
        >
          Download {title}
        </Button>
      </Stack>
    </Paper>
  );
}
