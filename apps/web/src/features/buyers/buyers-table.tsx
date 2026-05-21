import { Anchor, Badge, Checkbox, Group, ScrollArea, Table, Text } from '@mantine/core';
import type { MockProduct } from '../../mock/types';
import { AssignProductControl } from './assign-product-control';
import { buyerFullName, type BuyerRow } from './buyers-data';

interface BuyersTableProps {
  rows: BuyerRow[];
  products: MockProduct[];
  selectedIds: Set<string>;
  onToggleRow: (buyerId: string) => void;
  onToggleAll: (select: boolean) => void;
  onAssign: (buyerIds: string[], productId: string) => void;
  // The buyer whose row action is mid-assignment (null during a bulk assign).
  assigningBuyerId: string | null;
  // True while any assignment is in flight — locks every other row action.
  assignBusy: boolean;
}

// The Buyers people directory table (PG-205). One row per buyer; no row-click
// navigation — there is no buyer-detail view in the MVP, so buyers are managed
// entirely through the row action. Carries no readiness/alignment data by
// design (that is a deal concept). Checkboxes appear only on unassigned rows,
// which are the only rows the assignment flow (PG-207) acts on.
export function BuyersTable({
  rows,
  products,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onAssign,
  assigningBuyerId,
  assignBusy,
}: BuyersTableProps) {
  const unassignedRows = rows.filter((r) => r.status === 'unassigned');
  const selectedUnassigned = unassignedRows.filter((r) => selectedIds.has(r.buyer.id));
  const allSelected =
    unassignedRows.length > 0 && selectedUnassigned.length === unassignedRows.length;
  const someSelected = selectedUnassigned.length > 0 && !allSelected;

  return (
    <ScrollArea>
      <Table highlightOnHover withTableBorder verticalSpacing="sm" miw={920}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={44}>
              <Checkbox
                aria-label="Select all unassigned buyers"
                checked={allSelected}
                indeterminate={someSelected}
                disabled={unassignedRows.length === 0}
                onChange={(e) => onToggleAll(e.currentTarget.checked)}
              />
            </Table.Th>
            <Table.Th>Buyer</Table.Th>
            <Table.Th>Company</Table.Th>
            <Table.Th>Title</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th style={{ textAlign: 'right' }}>Opportunities</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th w={170} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => {
            const { buyer } = row;
            const isUnassigned = row.status === 'unassigned';
            return (
              <Table.Tr key={buyer.id}>
                <Table.Td>
                  {isUnassigned && (
                    <Checkbox
                      aria-label={`Select ${buyerFullName(buyer)}`}
                      checked={selectedIds.has(buyer.id)}
                      onChange={() => onToggleRow(buyer.id)}
                    />
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {buyerFullName(buyer)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{buyer.company}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {buyer.title ?? '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {buyer.email ? (
                    <Anchor size="sm" href={`mailto:${buyer.email}`} lineClamp={1}>
                      {buyer.email}
                    </Anchor>
                  ) : (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text size="sm" c={row.opportunityCount > 0 ? undefined : 'dimmed'}>
                    {row.opportunityCount > 0 ? row.opportunityCount : '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" size="sm" color={isUnassigned ? 'yellow' : 'teal'}>
                    {isUnassigned ? 'Unassigned' : 'Assigned'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {isUnassigned && (
                    <Group justify="flex-end">
                      <AssignProductControl
                        products={products}
                        label="Assign product"
                        loading={assigningBuyerId === buyer.id}
                        disabled={assignBusy && assigningBuyerId !== buyer.id}
                        onAssign={(productId) => onAssign([buyer.id], productId)}
                      />
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
