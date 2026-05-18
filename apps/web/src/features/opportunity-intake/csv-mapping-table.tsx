import { Badge, Select, Table, Text } from '@mantine/core';
import { TARGET_FIELDS, type ColumnMapping, type TargetField } from '../../mock/fake-csv-mapper';

interface CsvMappingTableProps {
  mappings: ColumnMapping[];
  onChange: (index: number, target: TargetField | null) => void;
}

const TARGET_OPTIONS = [
  { value: '__none__', label: '— ignore —' },
  ...TARGET_FIELDS.map((f) => ({ value: f, label: f.replace(/_/g, ' ') })),
];

export function CsvMappingTable({ mappings, onChange }: CsvMappingTableProps) {
  return (
    <Table withTableBorder verticalSpacing="xs" highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Source column</Table.Th>
          <Table.Th>Maps to</Table.Th>
          <Table.Th>Confidence</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {mappings.map((m, i) => (
          <Table.Tr key={`${m.source_column}-${i}`}>
            <Table.Td>
              <Text size="sm" fw={500}>
                {m.source_column}
              </Text>
            </Table.Td>
            <Table.Td>
              <Select
                size="xs"
                data={TARGET_OPTIONS}
                value={m.target_field ?? '__none__'}
                onChange={(value) =>
                  onChange(i, value === '__none__' || !value ? null : (value as TargetField))
                }
                allowDeselect={false}
              />
            </Table.Td>
            <Table.Td>
              <ConfidenceBadge confidence={m.confidence} reasoning={m.reasoning} />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function ConfidenceBadge({
  confidence,
  reasoning,
}: {
  confidence: number;
  reasoning: string;
}) {
  if (confidence === 0) {
    return (
      <Badge color="gray" variant="light" title={reasoning}>
        Unmapped
      </Badge>
    );
  }
  if (confidence >= 0.9) {
    return (
      <Badge color="teal" variant="light" title={reasoning}>
        High
      </Badge>
    );
  }
  if (confidence >= 0.7) {
    return (
      <Badge color="yellow" variant="light" title={reasoning}>
        Medium
      </Badge>
    );
  }
  return (
    <Badge color="orange" variant="light" title={reasoning}>
      Low
    </Badge>
  );
}
