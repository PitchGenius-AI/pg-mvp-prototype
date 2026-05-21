import { Badge, Group, ScrollArea, Stack, Table, Text, UnstyledButton } from '@mantine/core';
import { IconArrowsSort, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { AlignmentBadge } from '../../components/alignment-badge';
import { relativeTime } from '../../lib/relative-time';
import { ReadinessBadge } from './readiness-badge';
import { buyerName, companyName, type WorkbenchRow } from './workbench-data';
import type { SortColumn, SortDir } from './workbench-search';

interface ListViewProps {
  rows: WorkbenchRow[];
  sort: SortColumn;
  dir: SortDir;
  onSort: (column: SortColumn) => void;
  showProduct: boolean;
}

// The List view (PG-202): a flat, sortable table — one row per opportunity.
// Default sort (alignment severity, over-projecting first) is applied upstream.
export function ListView({ rows, sort, dir, onSort, showProduct }: ListViewProps) {
  const navigate = useNavigate();
  const headerProps = { sort, dir, onSort };

  return (
    <ScrollArea>
      <Table highlightOnHover withTableBorder verticalSpacing="sm" miw={showProduct ? 1480 : 1380}>
        <Table.Thead>
          <Table.Tr>
            <SortableTh column="buyer" label="Buyer" {...headerProps} />
            <SortableTh column="company" label="Company" {...headerProps} />
            {showProduct && <SortableTh column="product" label="Product" {...headerProps} />}
            <SortableTh column="stage" label="CRM stage" {...headerProps} />
            <SortableTh column="readiness" label="Readiness" {...headerProps} />
            <SortableTh column="alignment" label="Alignment" {...headerProps} />
            <SortableTh column="score" label="Score" numeric {...headerProps} />
            <Table.Th>Primary blocker</Table.Th>
            <SortableTh column="activity" label="Last activity" {...headerProps} />
            <Table.Th>Next action</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => {
            const { opportunity } = row;
            return (
              <Table.Tr
                key={opportunity.id}
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  navigate({
                    to: '/opportunities/$opportunityId',
                    params: { opportunityId: opportunity.id },
                  })
                }
              >
                <Table.Td>
                  <Stack gap={0}>
                    <Text size="sm" fw={500}>
                      {buyerName(row) || '—'}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {opportunity.opportunityName}
                    </Text>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{companyName(row) || '—'}</Text>
                </Table.Td>
                {showProduct && (
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {row.product?.name ?? '—'}
                    </Text>
                  </Table.Td>
                )}
                <Table.Td>
                  <Badge variant="light" color="gray" size="sm">
                    {opportunity.currentCrmStage}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <ReadinessBadge state={opportunity.currentReadinessState} score={null} />
                </Table.Td>
                <Table.Td>
                  <AlignmentBadge
                    outcome={opportunity.currentAlignmentOutcome}
                    level={opportunity.currentAlignmentLevel}
                  />
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text size="sm" fw={500}>
                    {opportunity.currentReadinessScore ?? '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed" lineClamp={2} maw={220}>
                    {row.primaryBlocker ?? '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {relativeTime(row.latestActivityDate)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed" lineClamp={2} maw={240}>
                    {row.nextAction ?? '—'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}

interface SortableThProps {
  column: SortColumn;
  label: string;
  sort: SortColumn;
  dir: SortDir;
  onSort: (column: SortColumn) => void;
  numeric?: boolean;
}

function SortableTh({ column, label, sort, dir, onSort, numeric }: SortableThProps) {
  const active = sort === column;
  return (
    <Table.Th style={{ textAlign: numeric ? 'right' : undefined }}>
      <UnstyledButton onClick={() => onSort(column)} aria-label={`Sort by ${label}`}>
        <Group gap={4} wrap="nowrap" justify={numeric ? 'flex-end' : 'flex-start'}>
          <Text size="xs" fw={600}>
            {label}
          </Text>
          {active ? (
            dir === 'asc' ? (
              <IconChevronUp size={13} />
            ) : (
              <IconChevronDown size={13} />
            )
          ) : (
            <IconArrowsSort size={13} style={{ opacity: 0.4 }} />
          )}
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}
