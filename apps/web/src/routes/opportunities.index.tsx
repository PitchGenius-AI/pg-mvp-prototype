import { Container, Stack, Text, Title } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/opportunities/')({
  component: OpportunityListPage,
});

// TODO: list opportunities for the user's workspace, with current readiness state +
// alignment badges (over/aligned/under), at-risk flag, and an "Add opportunity" CTA
// that opens a modal with three intake methods (form, quick paste, CSV).
function OpportunityListPage() {
  return (
    <Container py="xl">
      <Stack>
        <Title order={2}>Opportunities</Title>
        <Text c="dimmed">List view goes here.</Text>
      </Stack>
    </Container>
  );
}
