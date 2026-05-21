import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Code,
  Collapse,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconCheck,
  IconChevronDown,
  IconClipboardCopy,
  IconCopy,
  IconExternalLink,
  IconFileText,
} from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { AlignmentBadge } from '../../components/alignment-badge';
import { buildCrmNote } from '../../lib/exports';
import { relativeTime } from '../../lib/relative-time';
import type { ExportPackRow } from '../../mock/export-pack-rows';
import { useRecordExport } from '../../mock/hooks';
import { ReadinessBadge } from '../workbench/readiness-badge';

interface PackRowProps {
  row: ExportPackRow;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  showProduct: boolean;
}

// One opportunity in the CRM Update Pack (M18, PG-229/230). The collapsed row
// shows what will be written back and its export tier; expanding it previews
// the exact note and — for copy-only deals — offers the inline resolution
// (copy the note now, or open the deal to add a CRM Record ID). No row is ever
// silently dropped: a copy-only deal stays visible, just out of the import file.
export function PackRow({ row, checked, onToggle, showProduct }: PackRowProps) {
  const [expanded, setExpanded] = useState(false);
  const clipboard = useClipboard({ timeout: 2000 });
  const recordExport = useRecordExport();
  const navigate = useNavigate();

  const { opportunity, buyer } = row;
  const note = useMemo(
    () => buildCrmNote({ opportunity, buyer, diagnosis: row.latestDiagnosis }),
    [opportunity, buyer, row.latestDiagnosis],
  );

  const buyerName = buyer
    ? [buyer.firstName, buyer.lastName].filter(Boolean).join(' ')
    : 'Unknown buyer';
  const isCopyOnly = row.tier === 'copy_only';

  const openOpportunity = () =>
    navigate({
      to: '/opportunities/$opportunityId',
      params: { opportunityId: opportunity.id },
    });

  const copyNote = () => {
    clipboard.copy(note);
    // Copying resolves a copy-only deal — stamp it exported, same as the file
    // download stamps the CRM-note deals (M17 parity).
    recordExport.mutate(opportunity.id);
    notifications.show({
      color: 'teal',
      title: 'Note copied',
      message: `${buyerName} — paste it into your CRM activity log.`,
    });
  };

  return (
    <Paper withBorder radius="md" p="sm">
      <Group wrap="nowrap" align="flex-start" gap="sm">
        <Checkbox
          checked={checked}
          onChange={(e) => onToggle(e.currentTarget.checked)}
          aria-label={`Include ${buyerName} in the update pack`}
          mt={2}
        />

        <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" wrap="nowrap" gap="sm" align="flex-start">
            <Box style={{ minWidth: 0 }}>
              <Group gap={6} wrap="wrap">
                <Text fw={600} size="sm">
                  {buyerName}
                </Text>
                <Text size="sm" c="dimmed">
                  · {buyer?.company ?? '—'}
                </Text>
              </Group>
              <Text size="xs" c="dimmed" truncate>
                {opportunity.opportunityName}
                {showProduct && row.product ? ` · ${row.product.name}` : ''}
              </Text>
            </Box>
            <Group gap={4} wrap="nowrap">
              <TierBadge tier={row.tier} />
              <Tooltip label="Open opportunity" withArrow>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={openOpportunity}
                  aria-label="Open opportunity"
                >
                  <IconExternalLink size={16} />
                </ActionIcon>
              </Tooltip>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? 'Hide note preview' : 'Preview note'}
              >
                <IconChevronDown
                  size={16}
                  style={{
                    transform: expanded ? 'rotate(180deg)' : undefined,
                    transition: 'transform 150ms ease',
                  }}
                />
              </ActionIcon>
            </Group>
          </Group>

          <Group gap="md" wrap="wrap" align="center">
            <Group gap={6} align="center">
              <ReadinessBadge state={row.readinessState} score={row.readinessScore} size="sm" />
              <Movement row={row} />
            </Group>
            <Badge variant="default" size="sm" radius="sm">
              {opportunity.currentCrmStage || 'No stage'}
            </Badge>
            <AlignmentBadge
              outcome={opportunity.currentAlignmentOutcome}
              level={opportunity.currentAlignmentLevel}
            />
            <Text size="xs" c="dimmed">
              {activityLabel(row)}
              {row.lastExportedAt ? ` · last exported ${relativeTime(row.lastExportedAt)}` : ''}
            </Text>
          </Group>
        </Stack>
      </Group>

      <Collapse in={expanded}>
        <Divider my="sm" />
        <Stack gap="sm">
          <Group gap={6}>
            <IconFileText size={15} color="var(--mantine-color-dimmed)" />
            <Text size="xs" c="dimmed">
              The note this deal will export — the same note as its Export tab.
            </Text>
          </Group>
          <Code block style={{ whiteSpace: 'pre-wrap', maxHeight: 280, overflow: 'auto' }}>
            {note}
          </Code>

          {isCopyOnly ? (
            <Group gap="sm" align="center" wrap="wrap">
              <Button
                size="xs"
                leftSection={clipboard.copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                color={clipboard.copied ? 'teal' : undefined}
                variant={clipboard.copied ? 'light' : 'filled'}
                onClick={copyNote}
              >
                {clipboard.copied ? 'Copied' : 'Copy note'}
              </Button>
              <Button
                size="xs"
                variant="default"
                onClick={openOpportunity}
                leftSection={<IconExternalLink size={14} />}
              >
                Add a CRM Record ID
              </Button>
              <Text size="xs" c="dimmed" style={{ flex: '1 1 220px' }}>
                No CRM Record ID — this deal can't join the import file. Copy its note by hand, or
                add a Record ID on the opportunity to include it next time.
              </Text>
            </Group>
          ) : (
            <Group gap="sm" align="center" wrap="wrap">
              <Button
                size="xs"
                variant="default"
                leftSection={clipboard.copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                onClick={copyNote}
              >
                {clipboard.copied ? 'Copied' : 'Copy note'}
              </Button>
              <Text size="xs" c="dimmed">
                Included in the update pack file when this deal is checked.
              </Text>
            </Group>
          )}
        </Stack>
      </Collapse>
    </Paper>
  );
}

// Export-tier chip — `CRM note` deals join the import file; `Copy only` deals
// surface a per-row copy button instead (PG-229).
function TierBadge({ tier }: { tier: ExportPackRow['tier'] }) {
  if (tier === 'crm_import') {
    return (
      <Badge variant="light" color="teal" size="sm" leftSection={<IconFileText size={11} />}>
        CRM note
      </Badge>
    );
  }
  return (
    <Badge variant="light" color="gray" size="sm" leftSection={<IconClipboardCopy size={11} />}>
      Copy only
    </Badge>
  );
}

// Score movement since the last export (PG-229). A never-exported deal has no
// baseline — its whole readiness is new to the CRM, so it reads "New".
function Movement({ row }: { row: ExportPackRow }) {
  if (row.lastExportedAt === null) {
    return (
      <Badge variant="light" color="blue" size="sm">
        New
      </Badge>
    );
  }
  if (row.scoreSinceExport === null || row.scoreSinceExport === 0) {
    return (
      <Text size="xs" c="dimmed">
        No score change
      </Text>
    );
  }
  const up = row.scoreSinceExport > 0;
  return (
    <Group gap={2} align="center">
      {up ? (
        <IconArrowUpRight size={14} color="var(--mantine-color-teal-7)" />
      ) : (
        <IconArrowDownRight size={14} color="var(--mantine-color-red-7)" />
      )}
      <Text size="xs" fw={600} c={up ? 'teal' : 'red'}>
        {up ? '+' : ''}
        {row.scoreSinceExport} since export
      </Text>
    </Group>
  );
}

function activityLabel(row: ExportPackRow): string {
  if (row.lastExportedAt === null) {
    const n = row.totalActivityCount;
    return `${n} ${n === 1 ? 'activity' : 'activities'} logged`;
  }
  const n = row.activitySinceExport;
  if (n === 0) return 'No new activity';
  return `${n} new ${n === 1 ? 'activity' : 'activities'}`;
}
