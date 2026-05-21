import {
  Alert,
  Anchor,
  Button,
  Center,
  Checkbox,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { Dropzone, MIME_TYPES } from '@mantine/dropzone';
import {
  IconArrowLeft,
  IconCircleCheck,
  IconDownload,
  IconFileSpreadsheet,
  IconHistory,
  IconInfoCircle,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import Papa from 'papaparse';
import { useMemo, useState } from 'react';
import {
  useAddImportMapping,
  useCurrentWorkspace,
  useImportBuyerRows,
  useImportMappings,
  useProducts,
} from '../../mock/hooks';
import {
  applySavedMapping,
  autoMapColumns,
  toMappingFields,
  type ColumnMapping,
  type ImportTargetField,
} from '../../mock/fake-import-mapper';
import type { ImportResult } from '../../mock/store';
import {
  analyzeRows,
  requiredFieldsMapped,
  summarize,
  type SourceRow,
} from './import-data';
import { ImportCrmGuidance } from './import-crm-guidance';
import { ImportMappingTable } from './import-mapping-table';
import { ImportReview, type AssignmentMode } from './import-review';

type ImportStep = 'upload' | 'mapping' | 'review' | 'done';

// Method C — Daily Workbench import (PG-212). A bulk intake path: upload one
// tabular export from the rep's CRM, adaptively map its columns with a
// confidence indicator and a confirmation gate, run the missing-data check +
// CRM Record ID soft gate, then commit with an assign-now-or-defer choice.
export function DailyImport() {
  const navigate = useNavigate();
  const { data: workspace } = useCurrentWorkspace();
  const { data: products } = useProducts();
  const { data: savedMappings } = useImportMappings();
  const importRows = useImportBuyerRows();
  const addMapping = useAddImportMapping();

  const productList = useMemo(() => products ?? [], [products]);
  const primary = useMemo(
    () => productList.find((p) => p.isPrimary) ?? productList[0] ?? null,
    [productList],
  );

  const [step, setStep] = useState<ImportStep>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceRows, setSourceRows] = useState<SourceRow[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [reusedMappingName, setReusedMappingName] = useState<string | null>(null);
  const [saveMapping, setSaveMapping] = useState(true);

  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('now');
  const [productOverride, setProductOverride] = useState<string | null>(null);
  const productId = productOverride ?? primary?.id ?? null;
  const [recordIdAck, setRecordIdAck] = useState(false);

  const [result, setResult] = useState<ImportResult | null>(null);

  // The first saved mapping is reused so the rep pays the mapping friction once.
  const savedMapping = savedMappings?.[0] ?? null;

  const analyzed = useMemo(
    () => (step === 'review' ? analyzeRows(sourceRows, mappings) : []),
    [step, sourceRows, mappings],
  );
  const summary = useMemo(() => summarize(analyzed), [analyzed]);

  const resetAll = () => {
    setStep('upload');
    setFileName(null);
    setError(null);
    setSourceRows([]);
    setMappings([]);
    setReusedMappingName(null);
    setSaveMapping(true);
    setAssignmentMode('now');
    setProductOverride(null);
    setRecordIdAck(false);
    setResult(null);
  };

  const handleDrop = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    const text = await file.text();
    const parsed = Papa.parse<SourceRow>(text, {
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
    // Reuse a saved mapping when one exists, otherwise auto-map from scratch.
    if (savedMapping) {
      setMappings(applySavedMapping(headers, savedMapping.fields));
      setReusedMappingName(savedMapping.name);
      setSaveMapping(false);
    } else {
      setMappings(autoMapColumns(headers));
      setReusedMappingName(null);
      setSaveMapping(true);
    }
    setSourceRows(parsed.data);
    setFileName(file.name);
    setStep('mapping');
  };

  const handleMappingChange = (index: number, target: ImportTargetField | null) => {
    setMappings((prev) =>
      prev.map((m, i) =>
        i === index
          ? {
              ...m,
              targetField: target,
              fromSaved: false,
              // A deliberate choice by the rep — treat it as fully confident.
              confidence: target ? 1 : 0,
              reasoning: target ? 'Set by you' : 'Not imported',
            }
          : m,
      ),
    );
  };

  const handleImport = () => {
    const rows = analyzed.filter((r) => r.importable).map((r) => r.row);
    if (rows.length === 0) return;
    const targetProductId = assignmentMode === 'now' ? productId : null;
    importRows.mutate(
      { productId: targetProductId, rows },
      {
        onSuccess: (importResult) => {
          // Persist the confirmed mapping so the next import reuses it.
          if (saveMapping && workspace) {
            addMapping.mutate({
              workspaceId: workspace.id,
              mapping: {
                name: workspace.crmType
                  ? `${workspace.crmType} Daily Workbench`
                  : 'Daily Workbench mapping',
                crmType: workspace.crmType,
                fields: toMappingFields(mappings),
              },
            });
          }
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
        <ImportCrmGuidance crmType={workspace?.crmType ?? null} />
        {savedMapping && (
          <Alert color="blue" variant="light" icon={<IconInfoCircle size={18} />}>
            You have a saved column mapping ({savedMapping.name}) — we'll apply it
            automatically and let you adjust it.
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
              <IconFileSpreadsheet size={44} />
            </Dropzone.Idle>
            <div>
              <Text size="md" fw={500}>
                Drop your Daily Workbench file here, or click to browse
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
        <Anchor href="/sample-daily-workbench.csv" download size="sm" c="dimmed">
          <Group gap={4}>
            <IconDownload size={14} />
            Download a sample Daily Workbench file
          </Group>
        </Anchor>
      </Stack>
    );
  }

  // --- Mapping step --------------------------------------------------------
  if (step === 'mapping') {
    const ready = requiredFieldsMapped(mappings);
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

        {reusedMappingName && (
          <Alert color="blue" variant="light" icon={<IconInfoCircle size={18} />}>
            Reused your saved mapping ({reusedMappingName}). Adjust anything that looks off
            below.
          </Alert>
        )}

        <Text size="sm" c="dimmed">
          We've matched your columns to Pitch Genius fields. Review the matches — the
          confidence badge flags anything worth a second look — and correct any that are
          wrong before confirming.
        </Text>

        <ImportMappingTable
          mappings={mappings}
          sampleRow={sourceRows[0]}
          onChange={handleMappingChange}
        />

        {!ready && (
          <Alert color="orange" variant="light" icon={<IconInfoCircle size={18} />}>
            Map a column to <strong>Buyer first name</strong> and one to{' '}
            <strong>Company</strong> to continue — they're the minimum needed to create a
            buyer.
          </Alert>
        )}

        <Checkbox
          checked={saveMapping}
          onChange={(e) => setSaveMapping(e.currentTarget.checked)}
          label="Save this mapping so the next import reuses it"
        />

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
    return (
      <ImportReview
        analyzed={analyzed}
        summary={summary}
        products={productList}
        assignmentMode={assignmentMode}
        onAssignmentModeChange={setAssignmentMode}
        productId={productId}
        onProductChange={setProductOverride}
        recordIdAck={recordIdAck}
        onRecordIdAckChange={setRecordIdAck}
        importing={importRows.isPending}
        onBack={() => setStep('mapping')}
        onImport={handleImport}
      />
    );
  }

  // --- Done step -----------------------------------------------------------
  const deferred = assignmentMode === 'defer';
  return (
    <Center py="xl">
      <Paper withBorder radius="md" p="xl" maw={520} w="100%">
        <Stack align="center" gap="sm">
          <ThemeIcon color="teal" variant="light" size={56} radius="xl">
            <IconCircleCheck size={32} />
          </ThemeIcon>
          <Text fw={600} fz="lg">
            Import complete
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            {result && result.buyersCreated > 0 && (
              <>
                Added {result.buyersCreated} new{' '}
                {result.buyersCreated === 1 ? 'buyer' : 'buyers'}
                {result.buyersLinked > 0 &&
                  ` (${result.buyersLinked} ${
                    result.buyersLinked === 1 ? 'row' : 'rows'
                  } linked to buyers you already had)`}
                .{' '}
              </>
            )}
            {result && result.buyersCreated === 0 && result.buyersLinked > 0 && (
              <>All {result.buyersLinked} rows linked to buyers you already had. </>
            )}
            {deferred
              ? 'They\'re unassigned for now — assign a product on the Buyers screen to start tracking them.'
              : `Created ${result?.opportunitiesCreated ?? 0} ${
                  (result?.opportunitiesCreated ?? 0) === 1 ? 'opportunity' : 'opportunities'
                } — they're on your workbench now.`}
          </Text>
          <Group mt="md" gap="sm">
            {deferred ? (
              <Button
                onClick={() =>
                  navigate({ to: '/buyers', search: { status: 'unassigned' } })
                }
              >
                Assign products
              </Button>
            ) : (
              <Button onClick={() => navigate({ to: '/' })}>Go to workbench</Button>
            )}
            <Button variant="default" onClick={resetAll}>
              Import another file
            </Button>
          </Group>

          {!deferred && (result?.opportunitiesCreated ?? 0) > 0 && (
            <Paper withBorder radius="sm" p="sm" mt="xs" bg="var(--mantine-color-gray-light)">
              <Group justify="space-between" wrap="wrap" gap="xs">
                <Text size="xs" c="dimmed" style={{ flex: 1, minWidth: 220 }}>
                  Optional next step: import your CRM activity history so these
                  deals score from real conversations instead of provisionally.
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconHistory size={14} />}
                  onClick={() =>
                    navigate({ to: '/buyers/new', search: { method: 'activity' } })
                  }
                >
                  Add activity history
                </Button>
              </Group>
            </Paper>
          )}
        </Stack>
      </Paper>
    </Center>
  );
}
