import {
  Alert,
  Anchor,
  Badge,
  Button,
  Center,
  Group,
  List,
  Paper,
  SimpleGrid,
  Spoiler,
  Stack,
  Table,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { Dropzone, MIME_TYPES } from '@mantine/dropzone';
import {
  IconArrowLeft,
  IconCircleCheck,
  IconDownload,
  IconHistory,
  IconId,
  IconInfoCircle,
  IconRefresh,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { crmLabel } from '@pg/shared';
import { useNavigate } from '@tanstack/react-router';
import Papa from 'papaparse';
import { useMemo, useState } from 'react';
import { useCurrentWorkspace, useImportActivities, useOpportunities } from '../../mock/hooks';
import {
  ACTIVITY_TYPE_LABELS,
  autoMapActivityColumns,
  requiredActivityFieldsMapped,
  type ActivityColumnMapping,
  type ActivityTargetField,
} from '../../mock/fake-activity-mapper';
import type { ImportActivitiesResult } from '../../mock/store';
import {
  analyzeActivityRows,
  importableActivityRows,
  summarizeActivities,
  type ActivitySourceRow,
} from './activity-import-data';
import { ActivityMappingTable } from './activity-mapping-table';

type ActivityImportStep = 'upload' | 'mapping' | 'review' | 'done';

// The optional bulk Activities import (M15, PG-216/217/218). A rep uploads a
// calls/emails/meetings/notes export from their CRM; activities auto-join to
// their opportunities by CRM Record ID — no manual assignment — and every deal
// that gains an activity is re-scored, so day-one readiness reflects real
// conversations instead of staying provisional. Separate from the required
// Daily Workbench file: CRM activity history rarely exports in the same file.
export function ActivityImport() {
  const navigate = useNavigate();
  const { data: workspace } = useCurrentWorkspace();
  const { data: opportunities = [] } = useOpportunities();
  const importActivities = useImportActivities();

  const [step, setStep] = useState<ActivityImportStep>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceRows, setSourceRows] = useState<ActivitySourceRow[]>([]);
  const [mappings, setMappings] = useState<ActivityColumnMapping[]>([]);
  const [result, setResult] = useState<ImportActivitiesResult | null>(null);

  const analyzed = useMemo(
    () => (step === 'review' ? analyzeActivityRows(sourceRows, mappings, opportunities) : []),
    [step, sourceRows, mappings, opportunities],
  );
  const summary = useMemo(() => summarizeActivities(analyzed), [analyzed]);

  // Auto-join can only land on opportunities that carry a CRM Record ID.
  const joinableCount = useMemo(
    () => opportunities.filter((o) => o.crmRecordId).length,
    [opportunities],
  );

  const resetAll = () => {
    setStep('upload');
    setFileName(null);
    setError(null);
    setSourceRows([]);
    setMappings([]);
    setResult(null);
  };

  const handleDrop = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    const text = await file.text();
    const parsed = Papa.parse<ActivitySourceRow>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
    });
    if (parsed.errors.length > 0) {
      setError(`Couldn't read that file: ${parsed.errors[0]?.message ?? 'unknown error'}`);
      return;
    }
    const headers = (parsed.meta.fields ?? []).filter((h) => h.length > 0);
    if (headers.length === 0) {
      setError('That file has no column headers in its first row.');
      return;
    }
    if (parsed.data.length === 0) {
      setError('That file has headers but no data rows.');
      return;
    }
    setMappings(autoMapActivityColumns(headers));
    setSourceRows(parsed.data);
    setFileName(file.name);
    setStep('mapping');
  };

  const handleMappingChange = (index: number, target: ActivityTargetField | null) => {
    setMappings((prev) =>
      prev.map((m, i) =>
        i === index
          ? {
              ...m,
              targetField: target,
              // A deliberate choice by the rep — treat it as fully confident.
              confidence: target ? 1 : 0,
              reasoning: target ? 'Set by you' : 'Not imported',
            }
          : m,
      ),
    );
  };

  const handleImport = () => {
    const rows = importableActivityRows(analyzed);
    if (rows.length === 0) return;
    importActivities.mutate(
      { rows },
      {
        onSuccess: (importResult) => {
          setResult(importResult);
          setStep('done');
        },
      },
    );
  };

  // --- Upload step ---------------------------------------------------------
  if (step === 'upload') {
    return (
      <Stack gap="md">
        <Paper withBorder radius="md" p="md">
          <Stack gap="sm">
            <Group gap="xs" wrap="nowrap">
              <IconHistory size={18} />
              <Text size="sm" fw={600}>
                Add your activity history (optional)
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              Upload a calls / emails / meetings / notes export from
              {workspace?.crmType ? ` ${crmLabel(workspace.crmType)}` : ' your CRM'}.
              Each activity auto-joins to its deal by CRM Record ID — no manual
              assignment — and re-scores that deal's readiness from the real
              conversation.
            </Text>
            <List type="ordered" size="sm" spacing={4}>
              <List.Item>
                Open your CRM's activity, engagement, or task log.
              </List.Item>
              <List.Item>
                Export it to CSV — keep the column that holds the{' '}
                <strong>associated deal / Record ID</strong>. That's the auto-join key.
              </List.Item>
              <List.Item>Upload the file below — any column layout works.</List.Item>
            </List>
          </Stack>
        </Paper>

        {opportunities.length > 0 && joinableCount === 0 && (
          <Alert color="yellow" variant="light" icon={<IconId size={18} />}>
            None of your opportunities have a CRM Record ID yet, so there's
            nothing for activities to auto-join to. Import your Daily Workbench
            file with a Record ID column first.
          </Alert>
        )}

        <Dropzone
          onDrop={handleDrop}
          maxSize={5 * 1024 * 1024}
          accept={[MIME_TYPES.csv, 'text/csv', 'application/vnd.ms-excel']}
          multiple={false}
        >
          <Group justify="center" gap="xl" mih={140} style={{ pointerEvents: 'none' }}>
            <Dropzone.Accept>
              <IconUpload size={44} />
            </Dropzone.Accept>
            <Dropzone.Reject>
              <IconX size={44} />
            </Dropzone.Reject>
            <Dropzone.Idle>
              <IconHistory size={44} />
            </Dropzone.Idle>
            <div>
              <Text size="md" fw={500}>
                Drop your activity export here, or click to browse
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                CSV exported from your CRM, up to 5 MB. Any column layout works.
              </Text>
            </div>
          </Group>
        </Dropzone>
        {error && (
          <Alert color="red" variant="light" icon={<IconX size={18} />}>
            {error}
          </Alert>
        )}
        <Anchor
          href={`${import.meta.env.BASE_URL}sample-activities.csv`}
          download
          size="sm"
          c="dimmed"
        >
          <Group gap={4}>
            <IconDownload size={14} />
            Download a sample activities file
          </Group>
        </Anchor>
      </Stack>
    );
  }

  // --- Mapping step --------------------------------------------------------
  if (step === 'mapping') {
    const ready = requiredActivityFieldsMapped(mappings);
    return (
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <div>
            <Text size="sm" fw={600}>
              {fileName}
            </Text>
            <Text size="xs" c="dimmed">
              {sourceRows.length} {sourceRows.length === 1 ? 'row' : 'rows'} ·{' '}
              {mappings.length} columns
            </Text>
          </div>
          <Button variant="default" size="xs" onClick={resetAll}>
            Upload a different file
          </Button>
        </Group>

        <Text size="sm" c="dimmed">
          We've matched your columns to Pitch Genius fields. Review the matches —
          the confidence badge flags anything worth a second look — and correct any
          that are wrong before confirming.
        </Text>

        <ActivityMappingTable
          mappings={mappings}
          sampleRow={sourceRows[0]}
          onChange={handleMappingChange}
        />

        {!ready && (
          <Alert color="orange" variant="light" icon={<IconInfoCircle size={18} />}>
            Map a column to <strong>CRM Record ID</strong> (the auto-join key) and
            one to <strong>Subject</strong> or <strong>Notes / body</strong> to
            continue.
          </Alert>
        )}

        <Group justify="space-between">
          <Button
            variant="default"
            leftSection={<IconArrowLeft size={16} />}
            onClick={resetAll}
          >
            Back
          </Button>
          <Button disabled={!ready} onClick={() => setStep('review')}>
            Confirm mapping
          </Button>
        </Group>
      </Stack>
    );
  }

  // --- Review step ---------------------------------------------------------
  if (step === 'review') {
    const unmatchedRows = analyzed.filter((r) => r.status === 'unmatched');
    const canImport = summary.ready > 0 && !importActivities.isPending;
    return (
      <Stack gap="lg">
        <Paper withBorder radius="md" p="md">
          <Stack gap="md">
            <Text size="sm" fw={600}>
              What we found in your file
            </Text>
            <SimpleGrid cols={{ base: 2, sm: 4 }}>
              <Stat value={summary.total} label="Rows in file" />
              <Stat value={summary.ready} label="Will attach" />
              <Stat value={summary.unmatched} label="Unmatched" />
              <Stat value={summary.skipped} label="Skipped" />
            </SimpleGrid>
            {summary.ready > 0 && (
              <Text size="sm">
                <Text span fw={600}>
                  {summary.ready}
                </Text>{' '}
                {summary.ready === 1 ? 'activity' : 'activities'} will attach to{' '}
                <Text span fw={600}>
                  {summary.opportunitiesAffected}
                </Text>{' '}
                {summary.opportunitiesAffected === 1 ? 'opportunity' : 'opportunities'}{' '}
                and re-score their readiness.
              </Text>
            )}
            {summary.typeBreakdown.length > 0 && (
              <Group gap="xs">
                {summary.typeBreakdown.map(({ type, count }) => (
                  <Badge key={type} variant="light" color="gray">
                    {ACTIVITY_TYPE_LABELS[type]}: {count}
                  </Badge>
                ))}
              </Group>
            )}
            {summary.skipped > 0 && (
              <Text size="xs" c="dimmed">
                {summary.skipped} {summary.skipped === 1 ? 'row has' : 'rows have'} no
                subject or notes — there's nothing to score, so {summary.skipped === 1
                  ? "it's"
                  : "they're"}{' '}
                skipped.
              </Text>
            )}
          </Stack>
        </Paper>

        {unmatchedRows.length > 0 && (
          <Alert
            color="yellow"
            variant="light"
            icon={<IconId size={18} />}
            title="Some activities don't match a deal"
          >
            <Stack gap="sm">
              <Text size="sm">
                {unmatchedRows.length} {unmatchedRows.length === 1 ? 'activity' : 'activities'}{' '}
                reference a CRM Record ID that isn't on any of your opportunities.
                They won't be imported — bring the matching deals into your
                workbench first, then re-import this file.
              </Text>
              <Spoiler
                maxHeight={0}
                showLabel={`Show ${unmatchedRows.length} unmatched ${
                  unmatchedRows.length === 1 ? 'row' : 'rows'
                }`}
                hideLabel="Hide unmatched rows"
              >
                <Table mt="xs" withTableBorder verticalSpacing="xs" fz="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={60}>Row</Table.Th>
                      <Table.Th>CRM Record ID</Table.Th>
                      <Table.Th>Subject</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {unmatchedRows.map((r) => (
                      <Table.Tr key={r.index}>
                        <Table.Td>{r.index}</Table.Td>
                        <Table.Td>
                          <Text c={r.row.crmRecordId ? undefined : 'dimmed'}>
                            {r.row.crmRecordId ?? 'No Record ID'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text lineClamp={1}>{r.row.subject ?? r.row.body ?? '—'}</Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Spoiler>
            </Stack>
          </Alert>
        )}

        {summary.ready === 0 && (
          <Alert color="red" variant="light" icon={<IconX size={18} />}>
            No activities in this file match an opportunity, so there's nothing to
            import. Check your column mapping, or import the matching deals first.
          </Alert>
        )}

        <Group justify="space-between">
          <Button
            variant="default"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => setStep('mapping')}
          >
            Back to mapping
          </Button>
          <Button
            onClick={handleImport}
            disabled={!canImport}
            loading={importActivities.isPending}
            leftSection={<IconRefresh size={16} />}
          >
            Import &amp; re-score {summary.ready}{' '}
            {summary.ready === 1 ? 'activity' : 'activities'}
          </Button>
        </Group>
      </Stack>
    );
  }

  // --- Done step -----------------------------------------------------------
  return (
    <Center py="xl">
      <Paper withBorder radius="md" p="xl" maw={520} w="100%">
        <Stack align="center" gap="sm">
          <ThemeIcon color="teal" variant="light" size={56} radius="xl">
            <IconCircleCheck size={32} />
          </ThemeIcon>
          <Text fw={600} fz="lg">
            Activities imported
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            {result && result.activitiesImported > 0 ? (
              <>
                Attached {result.activitiesImported}{' '}
                {result.activitiesImported === 1 ? 'activity' : 'activities'} and
                re-scored readiness for {result.opportunitiesRescored}{' '}
                {result.opportunitiesRescored === 1 ? 'opportunity' : 'opportunities'}.
              </>
            ) : (
              <>No activities matched an opportunity, so nothing was imported.</>
            )}
            {result && result.activitiesUnmatched > 0 && (
              <>
                {' '}
                {result.activitiesUnmatched} unmatched{' '}
                {result.activitiesUnmatched === 1 ? 'activity was' : 'activities were'}{' '}
                skipped — import the matching deals, then re-import.
              </>
            )}
          </Text>
          <Group mt="md" gap="sm">
            <Button onClick={() => navigate({ to: '/' })}>Go to workbench</Button>
            <Button variant="default" onClick={resetAll}>
              Import another file
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Center>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <Stack gap={0} align="center">
      <Text fw={700} fz="xl">
        {value}
      </Text>
      <Text size="xs" c="dimmed" ta="center">
        {label}
      </Text>
    </Stack>
  );
}
