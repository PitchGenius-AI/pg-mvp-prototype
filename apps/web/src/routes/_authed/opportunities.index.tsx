import { Badge, Button, Container, Group, Stack, Table, Text, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { AddOpportunityModal } from '../../features/opportunity-intake';
import { useOpportunities } from '../../mock/hooks';

export const Route = createFileRoute('/_authed/opportunities/')({
  component: OpportunityListPage,
});

// M1 prototype: minimal list so the seed is visible. M5 owns the real filterable
// list view (search, alignment / at-risk filters, full empty state, etc).
function OpportunityListPage() {
  const { data: opportunities, isLoading } = useOpportunities();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <Container size="xl" py="lg">
      <Stack>
        <Group justify="space-between">
          <Title order={2}>Opportunities</Title>
          <Group gap="sm">
            <Text size="sm" c="dimmed">
              {opportunities?.length ?? 0} deals
            </Text>
            <Button leftSection={<IconPlus size={16} />} onClick={() => setAddOpen(true)}>
              Add opportunity
            </Button>
          </Group>
        </Group>
        {isLoading && <Text c="dimmed">Loading…</Text>}
        {opportunities && opportunities.length > 0 && (
          <Table highlightOnHover withTableBorder verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Opportunity</Table.Th>
                <Table.Th>CRM stage</Table.Th>
                <Table.Th>Readiness</Table.Th>
                <Table.Th>Alignment</Table.Th>
                <Table.Th>At risk</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {opportunities.map((o) => (
                <Table.Tr key={o.id}>
                  <Table.Td>
                    <Link
                      to="/opportunities/$opportunityId"
                      params={{ opportunityId: o.id }}
                      style={{ textDecoration: 'none', color: 'inherit', fontWeight: 500 }}
                    >
                      {o.opportunityName}
                    </Link>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{o.currentCrmStage}</Text>
                  </Table.Td>
                  <Table.Td>
                    {o.currentReadinessState ? (
                      <Badge variant="light">
                        {o.currentReadinessState.replace(/_/g, ' ')}
                        {o.currentReadinessScore != null ? ` · ${o.currentReadinessScore}` : ''}
                      </Badge>
                    ) : (
                      <Text size="sm" c="dimmed">
                        —
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {o.currentAlignmentOutcome ? (
                      <Badge
                        color={alignmentColor(o.currentAlignmentOutcome, o.currentAlignmentLevel)}
                        variant="light"
                      >
                        {o.currentAlignmentOutcome.replace(/_/g, ' ')}
                        {o.currentAlignmentLevel && o.currentAlignmentLevel !== 'none'
                          ? ` · ${o.currentAlignmentLevel}`
                          : ''}
                      </Badge>
                    ) : (
                      <Text size="sm" c="dimmed">
                        —
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {o.atRisk ? <Badge color="red">At risk</Badge> : <Text c="dimmed">—</Text>}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        {opportunities && opportunities.length === 0 && (
          <Stack align="center" gap="sm" py="xl">
            <Text c="dimmed">No opportunities yet.</Text>
            <Button leftSection={<IconPlus size={16} />} onClick={() => setAddOpen(true)}>
              Add your first opportunity
            </Button>
          </Stack>
        )}
      </Stack>
      <AddOpportunityModal opened={addOpen} onClose={() => setAddOpen(false)} />
    </Container>
  );
}

function alignmentColor(
  outcome: string,
  level: string | null,
): string {
  if (outcome === 'over_projecting') {
    if (level === 'critical' || level === 'high') return 'red';
    if (level === 'medium') return 'orange';
    return 'yellow';
  }
  if (outcome === 'under_projecting') return 'blue';
  return 'teal';
}
