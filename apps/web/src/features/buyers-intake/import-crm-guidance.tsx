import { Anchor, Collapse, Group, List, Paper, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAlertTriangle,
  IconChevronDown,
  IconChevronRight,
  IconFileExport,
} from '@tabler/icons-react';
import type { CrmType } from '@pg/shared';

interface ImportCrmGuidanceProps {
  crmType: CrmType | null;
}

interface Guidance {
  label: string;
  steps: string[];
  // An optional CRM-specific caveat shown below the steps.
  note?: string;
}

// [FLAG] Per-CRM export guidance is placeholder copy — the exact menu paths and
// the column that carries the CRM Record ID need confirming against 2–3 real
// sample exports per CRM (PG-212). The structure is final; the wording is not.
const GUIDANCE: Record<CrmType, Guidance> = {
  hubspot: {
    label: 'HubSpot',
    steps: [
      'Open the Deals view you work from each day.',
      'Make the Record ID column visible — Actions → Edit columns → add "Record ID". This is what Pitch Genius matches deals on.',
      'Choose Export, pick CSV, and keep all visible columns.',
      'Download the file, then upload it below.',
    ],
  },
  pipedrive: {
    label: 'Pipedrive',
    steps: [
      'Open the Deals list view you work from each day.',
      'Confirm the Deal ID column is shown — it becomes the CRM Record ID Pitch Genius matches deals on.',
      'Use the "…" menu → Export filter results → Export to CSV.',
      'Download the file, then upload it below.',
    ],
    note: 'Heads-up: a Pipedrive deal-list export only carries a Deal ID for contacts that have an associated deal. Contacts without one still import — they just come through without a Record ID.',
  },
};

const GENERIC: Guidance = {
  label: 'your CRM',
  steps: [
    'Open the pipeline or deals view you work from each day.',
    'Export it to a CSV file — any column layout works, the mapper adapts to it.',
    'If your CRM has a record/deal ID column, keep it: it lets exports write straight back as CRM notes later.',
    'Upload the file below.',
  ],
};

// The per-CRM "how to export your Daily Workbench file" step (PG-212). Collapsed
// after a rep has done it once; the export shape is keyed off the workspace's
// CRM so the steps name the right menus.
export function ImportCrmGuidance({ crmType }: ImportCrmGuidanceProps) {
  const [opened, { toggle }] = useDisclosure(true);
  const guidance = crmType ? GUIDANCE[crmType] : GENERIC;

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group
          justify="space-between"
          wrap="nowrap"
          onClick={toggle}
          style={{ cursor: 'pointer' }}
        >
          <Group gap="xs" wrap="nowrap">
            <IconFileExport size={18} />
            <Text size="sm" fw={600}>
              How to export your Daily Workbench file from {guidance.label}
            </Text>
          </Group>
          {opened ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
        </Group>
        <Collapse in={opened}>
          <List type="ordered" size="sm" spacing="xs" mt={4}>
            {guidance.steps.map((step) => (
              <List.Item key={step}>{step}</List.Item>
            ))}
          </List>
          {guidance.note && (
            <Group gap={6} wrap="nowrap" align="flex-start" mt="sm">
              <IconAlertTriangle
                size={15}
                color="var(--mantine-color-yellow-7)"
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <Text size="xs" c="dimmed">
                {guidance.note}
              </Text>
            </Group>
          )}
          <Text size="xs" c="dimmed" mt="sm">
            Not sure? Download a{' '}
            <Anchor
              href={`${import.meta.env.BASE_URL}sample-daily-workbench.csv`}
              download
              size="xs"
            >
              sample Daily Workbench file
            </Anchor>{' '}
            to see the shape Pitch Genius expects.
          </Text>
        </Collapse>
      </Stack>
    </Paper>
  );
}
