import { Anchor, Badge, Breadcrumbs, Group, Stack, Text, Title, Tooltip } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { AlignmentBadge } from '../../components/alignment-badge';
import { relativeTime } from '../opportunity-list/filter-sort';
import type { MockBuyer, MockOpportunity } from '../../mock/types';
import { humanize } from './badges';

interface OpportunityHeaderProps {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
  latestInteractionDate: string | null;
}

export function OpportunityHeader({
  opportunity,
  buyer,
  latestInteractionDate,
}: OpportunityHeaderProps) {
  return (
    <Stack gap={6}>
      <Breadcrumbs separator="›" mb={2}>
        <Anchor component={Link} to="/opportunities" size="sm" c="dimmed">
          Opportunities
        </Anchor>
        <Text size="sm">{opportunity.opportunityName}</Text>
      </Breadcrumbs>

      <Group gap="sm" align="center">
        <Title order={2}>{opportunity.opportunityName}</Title>
        {opportunity.atRisk && (
          <Tooltip label="Flagged at risk">
            <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" />
          </Tooltip>
        )}
      </Group>

      {buyer && (
        <Text size="sm" c="dimmed">
          {[buyer.firstName, buyer.lastName].filter(Boolean).join(' ')} · {buyer.company}
          {buyer.title ? ` · ${buyer.title}` : ''}
        </Text>
      )}

      <Group gap="xs" mt={4} align="center">
        <Badge variant="light" color="gray">
          {opportunity.currentCrmStage}
        </Badge>
        {opportunity.currentReadinessState && (
          <Badge variant="light">
            {humanize(opportunity.currentReadinessState)}
            {opportunity.currentReadinessScore != null
              ? ` · ${opportunity.currentReadinessScore}`
              : ''}
          </Badge>
        )}
        <AlignmentBadge
          outcome={opportunity.currentAlignmentOutcome}
          level={opportunity.currentAlignmentLevel}
          size="md"
        />
        {latestInteractionDate && (
          <Text size="xs" c="dimmed">
            Last activity {relativeTime(latestInteractionDate)}
          </Text>
        )}
      </Group>
    </Stack>
  );
}
