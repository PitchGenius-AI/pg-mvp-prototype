import { ScrollArea, Table } from '@mantine/core';
import { OpportunityRow } from './opportunity-row';
import type { OpportunityRowData } from './filter-sort';

interface OpportunityListProps {
  rows: OpportunityRowData[];
}

export function OpportunityList({ rows }: OpportunityListProps) {
  return (
    <ScrollArea>
      <Table highlightOnHover withTableBorder verticalSpacing="sm" miw={760}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Opportunity</Table.Th>
            <Table.Th>CRM stage</Table.Th>
            <Table.Th>Readiness</Table.Th>
            <Table.Th>Alignment</Table.Th>
            <Table.Th>Last activity</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <OpportunityRow key={row.opportunity.id} row={row} />
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
