import { createFileRoute, redirect } from '@tanstack/react-router';
import { OnboardingWizard } from '../features/onboarding/wizard';
import { useMockStore } from '../mock/store';

export const Route = createFileRoute('/onboarding')({
  // Onboarding requires a session even though it sits outside `_authed/`.
  // If already complete, skip straight to the app.
  beforeLoad: () => {
    const session = useMockStore.getState().session;
    if (!session) throw redirect({ to: '/login', search: { redirect: '/onboarding' } });
    if (session.workspaceOnboardingCompleted) throw redirect({ to: '/opportunities' });
  },
  component: OnboardingWizard,
});
