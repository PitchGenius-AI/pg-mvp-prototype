import { Box, ScrollArea, Stack, Table } from '@mantine/core';
import { OpportunityCard } from './opportunity-card';
import { OpportunityRow } from './opportunity-row';
import type { OpportunityRowData } from './filter-sort';

interface OpportunityListProps {
  rows: OpportunityRowData[];
}

// Two layouts, swapped at the `sm` breakpoint via Mantine's responsive `hiddenFrom`/`visibleFrom`:
// - below sm: stacked cards (no horizontal scroll, narrow-width friendly)
// - sm+: existing scrollable table
// Both render the same row data and link to the same detail route.
export function OpportunityList({ rows }: OpportunityListProps) {
  return (
    <>
      <Stack gap="sm" hiddenFrom="sm">
        {rows.map((row) => (
          <OpportunityCard key={row.opportunity.id} row={row} />
        ))}
      </Stack>

      <Box visibleFrom="sm">
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
      </Box>
    </>
  );
}
