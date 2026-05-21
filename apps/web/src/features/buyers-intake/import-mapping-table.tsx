import { Badge, Select, Table, Text, Tooltip } from '@mantine/core';
import {
  confidenceTier,
  IMPORT_FIELD_LABELS,
  IMPORT_TARGET_FIELDS,
  type ColumnMapping,
  type ConfidenceTier,
  type ImportTargetField,
} from '../../mock/fake-import-mapper';
import type { SourceRow } from './import-data';

interface ImportMappingTableProps {
  mappings: ColumnMapping[];
  // First data row, used to show a sample value per column.
  sampleRow: SourceRow | undefined;
  onChange: (index: number, target: ImportTargetField | null) => void;
}

const IGNORE = '__ignore__';

const TARGET_OPTIONS = [
  { value: IGNORE, label: "— don't import —" },
  ...IMPORT_TARGET_FIELDS.map((f) => ({ value: f, label: IMPORT_FIELD_LABELS[f] })),
];

const TIER_META: Record<ConfidenceTier, { color: string; label: string }> = {
  high: { color: 'teal', label: 'High' },
  medium: { color: 'yellow', label: 'Medium' },
  low: { color: 'orange', label: 'Low' },
  unmapped: { color: 'gray', label: 'Not mapped' },
};

// Adaptive column-mapping table for the Daily Workbench import (PG-212). Each
// source column gets an auto-mapped target with a confidence indicator; the rep
// reviews and corrects before the confirmation gate.
export function ImportMappingTable({
  mappings,
  sampleRow,
  onChange,
}: ImportMappingTableProps) {
  return (
    <Table.ScrollContainer minWidth={680}>
      <Table withTableBorder verticalSpacing="sm" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Column in your file</Table.Th>
            <Table.Th>Sample value</Table.Th>
            <Table.Th w={220}>Maps to</Table.Th>
            <Table.Th w={130}>Confidence</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {mappings.map((m, i) => {
            const tier = confidenceTier(m.confidence, m.targetField);
            const meta = TIER_META[tier];
            const sample = sampleRow?.[m.sourceColumn]?.trim();
            return (
              <Table.Tr key={`${m.sourceColumn}-${i}`}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {m.sourceColumn}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed" lineClamp={1}>
                    {sample && sample.length > 0 ? sample : '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    data={TARGET_OPTIONS}
                    value={m.targetField ?? IGNORE}
                    onChange={(value) =>
                      onChange(
                        i,
                        value === IGNORE || !value ? null : (value as ImportTargetField),
                      )
                    }
                    allowDeselect={false}
                    comboboxProps={{ withinPortal: true }}
                  />
                </Table.Td>
                <Table.Td>
                  <Tooltip label={m.reasoning} multiline w={240} withArrow>
                    <Badge color={meta.color} variant="light">
                      {m.fromSaved ? 'Saved' : meta.label}
                    </Badge>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
