import { Container, Stack, Text, Title } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/onboarding')({
  component: OnboardingPage,
});

// TODO: Implement the 5-minute onboarding wizard from spec §2:
// 1. Workspace name
// 2. Product: what you sell, who you sell to, what problem you solve
// 3. CRM stage template (Simple B2B Sales or Custom)
// Calls trpc.workspace.completeOnboarding on submit.
function OnboardingPage() {
  return (
    <Container size="md" py="xl">
      <Stack>
        <Title order={2}>Welcome to Pitch Genius</Title>
        <Text c="dimmed">
          A 5-minute onboarding wizard goes here — collect product context and CRM stages so the
          first diagnosis lands in the same session.
        </Text>
      </Stack>
    </Container>
  );
}
