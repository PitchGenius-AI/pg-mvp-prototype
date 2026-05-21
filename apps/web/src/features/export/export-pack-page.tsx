import {
  Alert,
  Button,
  Collapse,
  Container,
  Group,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconChevronDown, IconClipboardCopy, IconDownload } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCrmNote,
  buildCrmNotePackFile,
  type CrmNotePackEntry,
  downloadTextFile,
} from '../../lib/exports';
import { relativeTime } from '../../lib/relative-time';
import type { ExportPackRow } from '../../mock/export-pack-rows';
import {
  useCurrentWorkspace,
  useExportPack,
  useProducts,
  useRecordExportPack,
} from '../../mock/hooks';
import {
  ExportPackCaughtUp,
  ExportPackEmpty,
  ExportPackError,
  ExportPackGenerating,
  ExportPackLoading,
} from './export-pack-states';
import { ExportPackSuccess, type PackCopyOnlyEntry, type PackResult } from './export-pack-success';
import { PackRow } from './pack-row';

type Phase = 'idle' | 'generating' | 'done';

// The CRM Update Pack (M18) — the end-of-day bulk export, bookend to the
// morning Daily Workbench import. The rep reviews the day's worked deals, sees
// what will and won't be written back, and downloads one note-import file for
// their CRM. Note-based and two-tier (CRM note vs. copy-only, keyed on a CRM
// Record ID); export is pure bookkeeping — it stamps a per-deal timestamp and
// never mutates readiness, stage, or outcome.
export function ExportPackPage() {
  const navigate = useNavigate();
  const { data: workspace } = useCurrentWorkspace();
  const products = useProducts();
  const pack = useExportPack();
  const recordExportPack = useRecordExportPack();

  const rows = useMemo(() => pack.data ?? [], [pack.data]);
  const showProduct = (products.data?.length ?? 0) > 1;
  const crmType = workspace?.crmType ?? null;
  // No CRM selected → no note-import format exists, so every deal degrades to
  // copy-only and the per-row copy replaces the bulk download (PG-232).
  const copyOnlyMode = crmType === null;

  // The default working set: deals with new activity since the last export
  // (every deal with activity when never exported). Pre-checked on first load.
  const defaultIds = useMemo(
    () => rows.filter((r) => r.hasNewActivity).map((r) => r.opportunity.id),
    [rows],
  );
  // null = untouched (use the default set). A concrete Set once the rep
  // adds/removes anything.
  const [selectedOverride, setSelectedOverride] = useState<Set<string> | null>(null);
  const selected = selectedOverride ?? new Set(defaultIds);

  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<PackResult | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const generateTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (generateTimer.current) window.clearTimeout(generateTimer.current);
    },
    [],
  );

  const lastExportLabel = useMemo(() => {
    const stamps = rows.map((r) => r.lastExportedAt).filter((v): v is string => v !== null);
    if (stamps.length === 0) return null;
    return relativeTime(stamps.reduce((a, b) => (a > b ? a : b)));
  }, [rows]);

  const neverExported = rows.length > 0 && rows.every((r) => r.lastExportedAt === null);
  const defaultRows = rows.filter((r) => r.hasNewActivity);
  const otherRows = rows.filter((r) => !r.hasNewActivity);
  // Working set is empty but there are exportable deals to re-export (PG-232).
  const caughtUp = rows.length > 0 && defaultRows.length === 0;

  const selectedRows = rows.filter((r) => selected.has(r.opportunity.id));
  const selectedCrmNotes = selectedRows.filter((r) => r.tier === 'crm_import');
  const selectedCopyOnly = selectedRows.filter((r) => r.tier === 'copy_only');
  const canDownload = selectedCrmNotes.length > 0 && !copyOnlyMode;

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedOverride(next);
  };
  const selectAll = () => {
    setSelectedOverride(new Set(rows.map((r) => r.opportunity.id)));
    setShowOthers(true);
  };
  const clearAll = () => setSelectedOverride(new Set());

  const handleDownload = () => {
    setPhase('generating');
    generateTimer.current = window.setTimeout(() => {
      const fileEntries: CrmNotePackEntry[] = [];
      const copyOnly: PackCopyOnlyEntry[] = [];
      const exportedIds: string[] = [];
      let failedCount = 0;

      for (const row of selectedRows) {
        let note: string;
        try {
          note = buildCrmNote({
            opportunity: row.opportunity,
            buyer: row.buyer,
            diagnosis: row.latestDiagnosis,
          });
        } catch {
          // Per-row isolation (PG-232) — one bad note doesn't sink the pack.
          failedCount += 1;
          continue;
        }
        if (row.tier === 'crm_import' && row.opportunity.crmRecordId) {
          fileEntries.push({ recordId: row.opportunity.crmRecordId, note });
          exportedIds.push(row.opportunity.id);
        } else {
          copyOnly.push({ row, note });
        }
      }

      let filename: string | null = null;
      if (fileEntries.length > 0) {
        filename = `${crmSlug(crmType)}-update-pack-${new Date().toISOString().slice(0, 10)}.csv`;
        downloadTextFile(filename, buildCrmNotePackFile(fileEntries), 'text/csv');
      }
      // Only deals that landed in the file are stamped here — copy-only deals
      // are stamped when the rep copies them individually.
      if (exportedIds.length > 0) recordExportPack.mutate(exportedIds);

      setResult({
        filename,
        noteCount: fileEntries.length,
        copyOnly,
        failedCount,
        crmLabel: crmLabel(crmType),
      });
      setPhase('done');
      generateTimer.current = null;
    }, 900);
  };

  // --- Post-download confirmation -----------------------------------------
  if (phase === 'done' && result) {
    return (
      <Container size="lg" py="lg">
        <ExportPackSuccess
          result={result}
          onWorkbench={() => navigate({ to: '/' })}
          onDone={() => {
            setPhase('idle');
            setResult(null);
            setSelectedOverride(null);
          }}
        />
      </Container>
    );
  }

  const renderRow = (row: ExportPackRow) => (
    <PackRow
      key={row.opportunity.id}
      row={row}
      checked={selected.has(row.opportunity.id)}
      onToggle={(checked) => toggle(row.opportunity.id, checked)}
      showProduct={showProduct}
    />
  );

  return (
    <Container size="lg" py="lg">
      <Stack gap="md">
        <Stack gap={2}>
          <Title order={2}>CRM Update Pack</Title>
          <Text size="sm" c="dimmed">
            End of day — push what you learned back to your CRM. Review the deals you've worked,
            then download one file of notes to import.
          </Text>
        </Stack>

        {pack.isPending ? (
          <ExportPackLoading />
        ) : pack.isError ? (
          <ExportPackError onRetry={() => void pack.refetch()} />
        ) : phase === 'generating' ? (
          <ExportPackGenerating count={selectedRows.length} />
        ) : rows.length === 0 ? (
          <ExportPackEmpty
            onImportActivity={() => navigate({ to: '/buyers/new', search: { method: 'activity' } })}
            onWorkbench={() => navigate({ to: '/' })}
          />
        ) : (
          <Stack gap="md">
            {caughtUp ? (
              <ExportPackCaughtUp lastExportLabel={lastExportLabel} />
            ) : (
              <Text size="sm" c="dimmed">
                {neverExported
                  ? "Showing every opportunity with logged activity — you haven't exported before."
                  : `Showing deals with new buyer activity since your last export${
                      lastExportLabel ? ` ${lastExportLabel}` : ''
                    }.`}
              </Text>
            )}

            {copyOnlyMode && (
              <Alert color="gray" variant="light" icon={<IconClipboardCopy size={18} />}>
                <Text size="sm">
                  <Text span fw={600}>
                    No CRM connected.
                  </Text>{' '}
                  Notes can't be matched to CRM records automatically, so there's no import file to
                  download. Expand each deal below and copy its note into your CRM by hand.
                </Text>
              </Alert>
            )}

            <Group justify="space-between" wrap="wrap" gap="sm">
              <Text size="sm">
                <Text span fw={600}>
                  {selected.size}
                </Text>{' '}
                {selected.size === 1 ? 'deal' : 'deals'} in your pack
                {!copyOnlyMode && selected.size > 0 && (
                  <Text span c="dimmed">
                    {' '}
                    · {selectedCrmNotes.length} as CRM{' '}
                    {selectedCrmNotes.length === 1 ? 'note' : 'notes'}, {selectedCopyOnly.length}{' '}
                    copy-only
                  </Text>
                )}
              </Text>
              <Group gap="xs">
                <Button variant="subtle" size="xs" onClick={selectAll}>
                  Select all
                </Button>
                <Button variant="subtle" size="xs" color="gray" onClick={clearAll}>
                  Clear
                </Button>
              </Group>
            </Group>

            {defaultRows.length > 0 && <Stack gap="xs">{defaultRows.map(renderRow)}</Stack>}

            {otherRows.length > 0 && (
              <Stack gap="xs">
                <Button
                  variant="subtle"
                  size="xs"
                  color="gray"
                  w="fit-content"
                  leftSection={
                    <IconChevronDown
                      size={14}
                      style={{
                        transform: showOthers ? 'rotate(180deg)' : undefined,
                        transition: 'transform 150ms ease',
                      }}
                    />
                  }
                  onClick={() => setShowOthers((v) => !v)}
                >
                  {showOthers ? 'Hide' : 'Show'} {otherRows.length} other{' '}
                  {otherRows.length === 1 ? 'opportunity' : 'opportunities'}
                  {caughtUp ? ' to re-export' : ' with no new activity'}
                </Button>
                <Collapse in={showOthers}>
                  <Stack gap="xs">{otherRows.map(renderRow)}</Stack>
                </Collapse>
              </Stack>
            )}

            {!copyOnlyMode && (
              <Group justify="flex-end">
                {canDownload ? (
                  <Button leftSection={<IconDownload size={16} />} onClick={handleDownload}>
                    Download update pack ({selectedCrmNotes.length})
                  </Button>
                ) : (
                  <Tooltip
                    multiline
                    w={280}
                    label={
                      selected.size === 0
                        ? 'Select at least one deal to export.'
                        : "Every selected deal is copy-only — none carries a CRM Record ID, so there's no import file. Copy their notes individually from each row."
                    }
                  >
                    <Button leftSection={<IconDownload size={16} />} disabled>
                      Download update pack
                    </Button>
                  </Tooltip>
                )}
              </Group>
            )}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}

function crmLabel(crmType: string | null): string {
  if (crmType === 'hubspot') return 'HubSpot';
  if (crmType === 'pipedrive') return 'Pipedrive';
  return 'your CRM';
}

function crmSlug(crmType: string | null): string {
  if (crmType === 'hubspot') return 'hubspot';
  if (crmType === 'pipedrive') return 'pipedrive';
  return 'crm';
}
