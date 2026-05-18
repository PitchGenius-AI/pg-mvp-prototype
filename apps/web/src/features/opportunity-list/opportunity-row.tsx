import { Badge, Group, Stack, Table, Text, Tooltip } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { AlignmentBadge } from '../../components/alignment-badge';
import { relativeTime, type OpportunityRowData } from './filter-sort';

interface OpportunityRowProps {
  row: OpportunityRowData;
}

export function OpportunityRow({ row }: OpportunityRowProps) {
  const { opportunity, buyer, latestInteractionDate } = row;
  return (
    <Table.Tr>
      <Table.Td>
        <Link
          to="/opportunities/$opportunityId"
          params={{ opportunityId: opportunity.id }}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <Stack gap={2}>
            <Group gap={6} align="center">
              <Text fw={500} size="sm">
                {opportunity.opportunityName}
              </Text>
              {opportunity.atRisk && (
                <Tooltip label="Flagged at risk">
                  <IconAlertTriangle size={14} color="var(--mantine-color-red-6)" />
                </Tooltip>
              )}
            </Group>
            {buyer && (
              <Text size="xs" c="dimmed">
                {[buyer.firstName, buyer.lastName].filter(Boolean).join(' ')} ·{' '}
                {buyer.company}
              </Text>
            )}
          </Stack>
        </Link>
      </Table.Td>
      <Table.Td>
        <Badge variant="light" color="gray" size="sm">
          {opportunity.currentCrmStage}
        </Badge>
      </Table.Td>
      <Table.Td>
        {opportunity.currentReadinessState ? (
          <Badge variant="light" size="sm">
            {opportunity.currentReadinessState.replace(/_/g, ' ')}
            {opportunity.currentReadinessScore != null
              ? ` · ${opportunity.currentReadinessScore}`
              : ''}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <AlignmentBadge
          outcome={opportunity.currentAlignmentOutcome}
          level={opportunity.currentAlignmentLevel}
        />
      </Table.Td>
      <Table.Td>
        <Tooltip label={new Date(latestInteractionDate).toLocaleString()}>
          <Text size="sm" c="dimmed">
            {relativeTime(latestInteractionDate)}
          </Text>
        </Tooltip>
      </Table.Td>
    </Table.Tr>
  );
}
