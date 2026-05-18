import { Container, Stack, Tabs, Title } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/opportunities/$opportunityId')({
  component: OpportunityDetailPage,
});

// TODO: spec §7 — opportunity detail with Overview / Evidence / Diagnosis / Outcome / Export tabs.
function OpportunityDetailPage() {
  const { opportunityId } = Route.useParams();
  return (
    <Container py="xl">
      <Stack>
        <Title order={2}>Opportunity {opportunityId}</Title>
        <Tabs defaultValue="overview">
          <Tabs.List>
            <Tabs.Tab value="overview">Overview</Tabs.Tab>
            <Tabs.Tab value="evidence">Evidence</Tabs.Tab>
            <Tabs.Tab value="diagnosis">Diagnosis</Tabs.Tab>
            <Tabs.Tab value="outcome">Outcome</Tabs.Tab>
            <Tabs.Tab value="export">Export</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Stack>
    </Container>
  );
}
