import { ScrollArea, Table, Text } from '@mantine/core';
import type { ColumnMapping } from '../../mock/fake-csv-mapper';

interface CsvPreviewProps {
  mappings: ColumnMapping[];
  rows: Record<string, string>[];
}

export function CsvPreview({ mappings, rows }: CsvPreviewProps) {
  const previewRows = rows.slice(0, 5);
  return (
    <ScrollArea>
      <Table withTableBorder verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            {mappings.map((m) => (
              <Table.Th key={m.source_column}>
                <Text size="xs" fw={500}>
                  {m.target_field ? m.target_field.replace(/_/g, ' ') : '—'}
                </Text>
                <Text size="xs" c="dimmed">
                  ({m.source_column})
                </Text>
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {previewRows.map((row, i) => (
            <Table.Tr key={i}>
              {mappings.map((m) => (
                <Table.Td key={m.source_column}>
                  <Text size="xs">{row[m.source_column] ?? ''}</Text>
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
