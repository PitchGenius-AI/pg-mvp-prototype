import { Anchor, Button, Group, Stack, Text } from '@mantine/core';
import { Dropzone, MIME_TYPES } from '@mantine/dropzone';
import { IconDownload, IconFileSpreadsheet, IconUpload, IconX } from '@tabler/icons-react';
import Papa from 'papaparse';
import { useState } from 'react';
import { useCurrentProduct, useCurrentWorkspace, useSession } from '../../mock/hooks';
import {
  fakeMapCsvColumns,
  type ColumnMapping,
  type TargetField,
} from '../../mock/fake-csv-mapper';
import { mockAiCall } from '../../mock/mock-api';
import { CsvMappingTable } from './csv-mapping-table';
import { CsvPreview } from './csv-preview';
import { checkDedup, commitOpportunity, type PreSaveOpportunity } from './submit-helpers';

interface CsvUploadProps {
  onSuccess: (created: number, linked: number) => void;
}

type CsvStep = 'upload' | 'mapping';

export function CsvUpload({ onSuccess }: CsvUploadProps) {
  const { data: session } = useSession();
  const { data: workspace } = useCurrentWorkspace();
  const { data: product } = useCurrentProduct();

  const [step, setStep] = useState<CsvStep>('upload');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);
    const text = await file.text();
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    if (result.errors.length > 0) {
      setError(`Could not parse CSV: ${result.errors[0]?.message ?? 'unknown error'}`);
      return;
    }
    const headers = result.meta.fields ?? [];
    if (headers.length === 0) {
      setError('CSV has no headers.');
      return;
    }
    // Simulate an "AI mapping" call so the latency feels like the real chain.
    const suggested = await mockAiCall<ColumnMapping[]>(() => fakeMapCsvColumns(headers));
    setRows(result.data);
    setMappings(suggested);
    setStep('mapping');
  };

  const handleMappingChange = (index: number, target: TargetField | null) => {
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, target_field: target } : m)),
    );
  };

  const handleImport = () => {
    if (!session || !workspace || !product) return;
    const mappedRows = rows.map((row) => rowToDraft(row, mappings));
    let created = 0;
    let linked = 0;
    for (const draft of mappedRows) {
      if (!isImportable(draft)) continue;
      const match = checkDedup(workspace.id, draft);
      const strategy: { kind: 'create' } | { kind: 'link'; buyerId: string } = match
        ? { kind: 'link', buyerId: match.id }
        : { kind: 'create' };
      commitOpportunity(
        draft,
        {
          workspaceId: workspace.id,
          ownerUserId: session.user.id,
          productId: product.id,
        },
        strategy,
      );
      created += 1;
      if (match) linked += 1;
    }
    onSuccess(created, linked);
  };

  const handleReset = () => {
    setStep('upload');
    setRows([]);
    setMappings([]);
    setFileName(null);
    setError(null);
  };

  if (step === 'upload') {
    return (
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Upload a CSV exported from your CRM. The mapper will guess the column structure
          and you'll review before import.
        </Text>
        <Dropzone
          onDrop={handleDrop}
          maxSize={5 * 1024 * 1024}
          accept={[MIME_TYPES.csv, 'text/csv', 'application/vnd.ms-excel']}
          multiple={false}
        >
          <Group justify="center" gap="xl" mih={120} style={{ pointerEvents: 'none' }}>
            <Dropzone.Accept>
              <IconUpload size={40} />
            </Dropzone.Accept>
            <Dropzone.Reject>
              <IconX size={40} />
            </Dropzone.Reject>
            <Dropzone.Idle>
              <IconFileSpreadsheet size={40} />
            </Dropzone.Idle>
            <div>
              <Text size="md" fw={500}>
                Drop your CSV here or click to browse
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                Max 5 MB. First row should be headers.
              </Text>
            </div>
          </Group>
        </Dropzone>
        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}
        <Anchor
          href="/sample-opportunities.csv"
          download
          size="sm"
          c="dimmed"
        >
          <Group gap={4}>
            <IconDownload size={14} />
            Download sample CSV
          </Group>
        </Anchor>
      </Stack>
    );
  }

  // mapping step
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Text size="sm" fw={500}>
            {fileName}
          </Text>
          <Text size="xs" c="dimmed">
            {rows.length} rows · {mappings.length} columns
          </Text>
        </div>
        <Button variant="default" size="xs" onClick={handleReset}>
          Upload a different file
        </Button>
      </Group>
      <CsvMappingTable mappings={mappings} onChange={handleMappingChange} />
      <Text size="sm" fw={500} mt="sm">
        Preview (first 5 rows)
      </Text>
      <CsvPreview mappings={mappings} rows={rows} />
      <Group justify="flex-end">
        <Button onClick={handleImport} disabled={!isMappingValid(mappings)}>
          Import {rows.length} {rows.length === 1 ? 'row' : 'rows'}
        </Button>
      </Group>
    </Stack>
  );
}

function isMappingValid(mappings: ColumnMapping[]): boolean {
  const targets = new Set(mappings.map((m) => m.target_field).filter((t): t is TargetField => !!t));
  // Minimum required: a name for the buyer, a company, and an opportunity name.
  return (
    targets.has('buyer_first_name') &&
    targets.has('buyer_company') &&
    targets.has('opportunity_name')
  );
}

function isImportable(draft: PreSaveOpportunity): boolean {
  return (
    draft.buyer.firstName.length > 0 &&
    draft.buyer.company.length > 0 &&
    draft.opportunity.opportunityName.length > 0
  );
}

function rowToDraft(
  row: Record<string, string>,
  mappings: ColumnMapping[],
): PreSaveOpportunity {
  const getValue = (target: TargetField): string => {
    const mapping = mappings.find((m) => m.target_field === target);
    if (!mapping) return '';
    return (row[mapping.source_column] ?? '').trim();
  };
  const parseNumber = (s: string): number | null => {
    if (!s) return null;
    const cleaned = s.replace(/[,$]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  };
  const valueOrNull = (s: string): string | null => (s.length > 0 ? s : null);

  return {
    buyer: {
      firstName: getValue('buyer_first_name'),
      lastName: valueOrNull(getValue('buyer_last_name')),
      title: valueOrNull(getValue('buyer_title')),
      company: getValue('buyer_company'),
      email: valueOrNull(getValue('buyer_email')),
      linkedin: valueOrNull(getValue('buyer_linkedin')),
    },
    opportunity: {
      opportunityName: getValue('opportunity_name'),
      currentCrmStage: getValue('current_crm_stage') || 'New Lead',
      opportunityValue: parseNumber(getValue('opportunity_value')),
      expectedCloseDate: valueOrNull(getValue('expected_close_date')),
      knownPain: valueOrNull(getValue('known_pain')),
      knownObjection: valueOrNull(getValue('known_objection')),
      dealNotes: valueOrNull(getValue('deal_notes')),
    },
  };
}
