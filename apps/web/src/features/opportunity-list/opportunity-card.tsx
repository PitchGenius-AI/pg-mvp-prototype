import { Badge, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { AlignmentBadge } from '../../components/alignment-badge';
import { relativeTime, type OpportunityRowData } from './filter-sort';

interface OpportunityCardProps {
  row: OpportunityRowData;
}

// Stacked-card layout used below the `sm` breakpoint in place of the table.
// Same data as OpportunityRow, optimised for narrow widths — no horizontal
// scroll, everything readable in one column.
export function OpportunityCard({ row }: OpportunityCardProps) {
  const { opportunity, buyer, latestInteractionDate } = row;
  return (
    <Link
      to="/opportunities/$opportunityId"
      params={{ opportunityId: opportunity.id }}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
        <Group gap={6} align="center" wrap="nowrap">
          <Text fw={600} size="sm" style={{ flex: 1 }}>
            {opportunity.opportunityName}
          </Text>
          {opportunity.atRisk && (
            <Tooltip label="Flagged at risk">
              <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" />
            </Tooltip>
          )}
        </Group>

        {buyer && (
          <Text size="xs" c="dimmed">
            {[buyer.firstName, buyer.lastName].filter(Boolean).join(' ')} · {buyer.company}
          </Text>
        )}

        <Group gap="xs" wrap="wrap">
          <Badge variant="light" color="gray" size="sm">
            {opportunity.currentCrmStage}
          </Badge>
          {opportunity.currentReadinessState && (
            <Badge variant="light" size="sm">
              {opportunity.currentReadinessState.replace(/_/g, ' ')}
              {opportunity.currentReadinessScore != null
                ? ` · ${opportunity.currentReadinessScore}`
                : ''}
            </Badge>
          )}
        </Group>

        <Group justify="space-between" align="flex-end" wrap="nowrap">
          <AlignmentBadge
            outcome={opportunity.currentAlignmentOutcome}
            level={opportunity.currentAlignmentLevel}
          />
          <Tooltip label={new Date(latestInteractionDate).toLocaleString()}>
            <Text size="xs" c="dimmed">
              {relativeTime(latestInteractionDate)}
            </Text>
          </Tooltip>
        </Group>
        </Stack>
      </Paper>
    </Link>
  );
}
