import { Badge, Select, Table, Text, Tooltip } from '@mantine/core';
import {
  ACTIVITY_FIELD_LABELS,
  ACTIVITY_TARGET_FIELDS,
  activityConfidenceTier,
  type ActivityColumnMapping,
  type ActivityTargetField,
} from '../../mock/fake-activity-mapper';
import type { ConfidenceTier } from '../../mock/fake-import-mapper';
import type { ActivitySourceRow } from './activity-import-data';

interface ActivityMappingTableProps {
  mappings: ActivityColumnMapping[];
  // First data row, used to show a sample value per column.
  sampleRow: ActivitySourceRow | undefined;
  onChange: (index: number, target: ActivityTargetField | null) => void;
}

const IGNORE = '__ignore__';

const TARGET_OPTIONS = [
  { value: IGNORE, label: "— don't import —" },
  ...ACTIVITY_TARGET_FIELDS.map((f) => ({ value: f, label: ACTIVITY_FIELD_LABELS[f] })),
];

const TIER_META: Record<ConfidenceTier, { color: string; label: string }> = {
  high: { color: 'teal', label: 'High' },
  medium: { color: 'yellow', label: 'Medium' },
  low: { color: 'orange', label: 'Low' },
  unmapped: { color: 'gray', label: 'Not mapped' },
};

// Adaptive column-mapping table for the bulk Activities import (M15, PG-216).
// Each source column gets an auto-mapped target with a confidence indicator;
// the rep reviews and corrects before the confirmation gate.
export function ActivityMappingTable({
  mappings,
  sampleRow,
  onChange,
}: ActivityMappingTableProps) {
  return (
    <Table.ScrollContainer minWidth={620}>
      <Table withTableBorder verticalSpacing="sm" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Column in your file</Table.Th>
            <Table.Th>Sample value</Table.Th>
            <Table.Th w={210}>Maps to</Table.Th>
            <Table.Th w={130}>Confidence</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {mappings.map((m, i) => {
            const tier = activityConfidenceTier(m.confidence, m.targetField);
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
                        value === IGNORE || !value
                          ? null
                          : (value as ActivityTargetField),
                      )
                    }
                    allowDeselect={false}
                    comboboxProps={{ withinPortal: true }}
                  />
                </Table.Td>
                <Table.Td>
                  <Tooltip label={m.reasoning} multiline w={240} withArrow>
                    <Badge color={meta.color} variant="light">
                      {meta.label}
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
