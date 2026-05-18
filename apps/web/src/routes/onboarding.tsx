import { Button, Container, Stack, Text, Title } from '@mantine/core';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { mockActions, useMockStore } from '../mock/store';

export const Route = createFileRoute('/onboarding')({
  // Onboarding requires a session even though it sits outside `_authed/`.
  beforeLoad: () => {
    const session = useMockStore.getState().session;
    if (!session) throw redirect({ to: '/login', search: { redirect: '/onboarding' } });
  },
  component: OnboardingPage,
});

// M3 owns the full 3-step wizard (workspace name → product Q&A → CRM stage template).
// For M1 we just expose the "complete onboarding" gate so the redirect logic works end-to-end.
function OnboardingPage() {
  const navigate = useNavigate();
  return (
    <Container size="md" py="xl">
      <Stack>
        <Title order={2}>Welcome to Pitch Genius</Title>
        <Text c="dimmed">
          A 5-minute onboarding wizard goes here — collect product context and CRM stages so the
          first diagnosis lands in the same session. (Wizard UI is M3.)
        </Text>
        <Button
          onClick={() => {
            mockActions.completeOnboarding();
            navigate({ to: '/opportunities' });
          }}
          mt="md"
        >
          Mark onboarding complete (prototype)
        </Button>
      </Stack>
    </Container>
  );
}
