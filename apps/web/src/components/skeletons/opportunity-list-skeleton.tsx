import { ScrollArea, Skeleton, Stack, Table } from '@mantine/core';

interface OpportunityListSkeletonProps {
  rows?: number;
}

// Mirrors the column layout in opportunity-list/opportunity-list.tsx so the
// transition from skeleton to populated table introduces no layout shift.
export function OpportunityListSkeleton({ rows = 5 }: OpportunityListSkeletonProps) {
  return (
    <ScrollArea>
      <Table verticalSpacing="sm" miw={760}>
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
          {Array.from({ length: rows }).map((_, i) => (
            <Table.Tr key={i}>
              <Table.Td>
                <Stack gap={6}>
                  <Skeleton height={14} width="60%" radius="sm" />
                  <Skeleton height={10} width="45%" radius="sm" />
                </Stack>
              </Table.Td>
              <Table.Td>
                <Skeleton height={20} width={80} radius="xl" />
              </Table.Td>
              <Table.Td>
                <Skeleton height={20} width={120} radius="xl" />
              </Table.Td>
              <Table.Td>
                <Skeleton height={20} width={110} radius="xl" />
              </Table.Td>
              <Table.Td>
                <Skeleton height={12} width={80} radius="sm" />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
