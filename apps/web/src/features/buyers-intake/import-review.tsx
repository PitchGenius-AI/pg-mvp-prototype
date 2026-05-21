import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Paper,
  Radio,
  SimpleGrid,
  Spoiler,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconAlertTriangle, IconArrowLeft, IconId } from '@tabler/icons-react';
import type { MockProduct } from '../../mock/types';
import type { AnalyzedRow, ImportSummary } from './import-data';
import { ProductField } from './product-field';

export type AssignmentMode = 'now' | 'defer';

interface ImportReviewProps {
  analyzed: AnalyzedRow[];
  summary: ImportSummary;
  products: MockProduct[];
  assignmentMode: AssignmentMode;
  onAssignmentModeChange: (mode: AssignmentMode) => void;
  productId: string | null;
  onProductChange: (productId: string) => void;
  recordIdAck: boolean;
  onRecordIdAckChange: (ack: boolean) => void;
  importing: boolean;
  onBack: () => void;
  onImport: () => void;
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

// Review step of the Daily Workbench import (PG-212): the missing-data check, the
// CRM Record ID soft gate, and the product-assignment choice — the last gate
// before commit.
export function ImportReview({
  analyzed,
  summary,
  products,
  assignmentMode,
  onAssignmentModeChange,
  productId,
  onProductChange,
  recordIdAck,
  onRecordIdAckChange,
  importing,
  onBack,
  onImport,
}: ImportReviewProps) {
  const skippedRows = analyzed.filter((r) => !r.importable);
  // The soft gate only applies when there's something to acknowledge.
  const recordIdGateUnmet = summary.withoutRecordId > 0 && !recordIdAck;
  const productMissing = assignmentMode === 'now' && !productId;
  const canImport =
    summary.importable > 0 && !recordIdGateUnmet && !productMissing && !importing;

  return (
    <Stack gap="lg">
      {/* --- Missing-data check --- */}
      <Paper withBorder radius="md" p="md">
        <Stack gap="md">
          <Text size="sm" fw={600}>
            What we found in your file
          </Text>
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            <Stat value={summary.total} label="Rows in file" />
            <Stat value={summary.importable} label="Ready to import" />
            <Stat value={summary.withRecordId} label="With Record ID" />
            <Stat value={summary.skipped} label="Skipped" />
          </SimpleGrid>
          {summary.withoutStage > 0 && (
            <Text size="xs" c="dimmed">
              {summary.withoutStage}{' '}
              {summary.withoutStage === 1 ? 'row has' : 'rows have'} no CRM stage — those
              deals import unstaged and you can set a stage later.
            </Text>
          )}
          {skippedRows.length > 0 && (
            <Spoiler
              maxHeight={0}
              showLabel={`Show ${skippedRows.length} skipped ${
                skippedRows.length === 1 ? 'row' : 'rows'
              }`}
              hideLabel="Hide skipped rows"
            >
              <Table mt="xs" withTableBorder verticalSpacing="xs" fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={60}>Row</Table.Th>
                    <Table.Th>Buyer</Table.Th>
                    <Table.Th>Missing</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {skippedRows.map((r) => (
                    <Table.Tr key={r.index}>
                      <Table.Td>{r.index}</Table.Td>
                      <Table.Td>
                        {r.buyerName === '—' ? (
                          <Text c="dimmed">—</Text>
                        ) : (
                          r.buyerName
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text c="red">{r.missingRequired.join(', ')}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Text size="xs" c="dimmed" mt={4}>
                Skipped rows are missing a buyer first name or company — fix them in your
                file and re-import, or add them later with the structured form.
              </Text>
            </Spoiler>
          )}
        </Stack>
      </Paper>

      {/* --- CRM Record ID soft gate --- */}
      {summary.withoutRecordId > 0 && (
        <Alert
          color="yellow"
          variant="light"
          icon={<IconId size={18} />}
          title="Some deals have no CRM Record ID"
        >
          <Stack gap="sm">
            <Text size="sm">
              {summary.withoutRecordId} of {summary.importable} deals don't have a CRM
              Record ID. They'll still import — but Pitch Genius can't write updates straight
              back to those CRM records, so their end-of-day export is a copy-only note you
              paste in yourself.
            </Text>
            <Checkbox
              checked={recordIdAck}
              onChange={(e) => onRecordIdAckChange(e.currentTarget.checked)}
              label="I understand — import these deals anyway."
            />
          </Stack>
        </Alert>
      )}

      {/* --- Product-assignment choice --- */}
      <Paper withBorder radius="md" p="md">
        <Stack gap="md">
          <div>
            <Text size="sm" fw={600}>
              Assign a product?
            </Text>
            <Text size="xs" c="dimmed">
              A buyer becomes a tracked opportunity once it has a product. You can assign
              now, or import the buyers and decide later.
            </Text>
          </div>
          <Radio.Group
            value={assignmentMode}
            onChange={(v) => onAssignmentModeChange(v as AssignmentMode)}
          >
            <Stack gap="sm">
              <Radio
                value="now"
                label="Assign all to a product now"
                description="Creates an opportunity per row — they land on your workbench immediately."
              />
              <Radio
                value="defer"
                label="Decide later"
                description="Imports the buyers as unassigned — assign products from the Buyers screen when you're ready."
              />
            </Stack>
          </Radio.Group>
          {assignmentMode === 'now' && (
            <Paper withBorder radius="sm" p="sm" bg="var(--mantine-color-gray-light)">
              <ProductField
                products={products}
                value={productId}
                onChange={onProductChange}
              />
            </Paper>
          )}
        </Stack>
      </Paper>

      {summary.importable === 0 && (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />}>
          No rows in this file have both a buyer first name and a company, so there's
          nothing to import. Check your column mapping or your file.
        </Alert>
      )}

      <Group justify="space-between">
        <Button variant="default" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
          Back to mapping
        </Button>
        <Group gap="sm">
          {assignmentMode === 'defer' && summary.importable > 0 && (
            <Badge variant="light" color="gray" size="lg">
              {summary.importable} unassigned {summary.importable === 1 ? 'buyer' : 'buyers'}
            </Badge>
          )}
          <Button onClick={onImport} disabled={!canImport} loading={importing}>
            Import {summary.importable}{' '}
            {summary.importable === 1 ? 'row' : 'rows'}
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
