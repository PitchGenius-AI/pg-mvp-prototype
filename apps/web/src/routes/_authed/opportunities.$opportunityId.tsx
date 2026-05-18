import { Container, Stack, Tabs, Text, Title } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { useOpportunity } from '../../mock/hooks';

export const Route = createFileRoute('/_authed/opportunities/$opportunityId')({
  component: OpportunityDetailPage,
});

// M1 prototype: minimal detail header so navigation works. M6 owns the full 5-tab
// detail view (Overview / Evidence / Diagnosis / Outcome / Export).
function OpportunityDetailPage() {
  const { opportunityId } = Route.useParams();
  const { data: opportunity, isLoading } = useOpportunity(opportunityId);

  return (
    <Container size="xl" py="lg">
      <Stack>
        {isLoading && <Text c="dimmed">Loading…</Text>}
        {!isLoading && !opportunity && <Text c="red">Opportunity not found.</Text>}
        {opportunity && (
          <>
            <Title order={2}>{opportunity.opportunityName}</Title>
            <Text c="dimmed" size="sm">
              CRM stage: {opportunity.currentCrmStage}
            </Text>
            <Tabs defaultValue="overview" mt="sm">
              <Tabs.List>
                <Tabs.Tab value="overview">Overview</Tabs.Tab>
                <Tabs.Tab value="evidence">Evidence</Tabs.Tab>
                <Tabs.Tab value="diagnosis">Diagnosis</Tabs.Tab>
                <Tabs.Tab value="outcome">Outcome</Tabs.Tab>
                <Tabs.Tab value="export">Export</Tabs.Tab>
              </Tabs.List>
            </Tabs>
          </>
        )}
      </Stack>
    </Container>
  );
}
