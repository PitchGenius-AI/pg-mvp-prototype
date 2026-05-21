import { createFileRoute, redirect } from '@tanstack/react-router';
import { OnboardingWizard } from '../features/onboarding/wizard';
import { useMockStore } from '../mock/store';

export const Route = createFileRoute('/onboarding')({
  // Onboarding requires a session even though it sits outside `_authed/`.
  // If already complete, hand off to `/` — it routes on to /checkout (M11
  // paywall) or the app depending on subscription state.
  beforeLoad: () => {
    const session = useMockStore.getState().session;
    if (!session) throw redirect({ to: '/login', search: { redirect: '/onboarding' } });
    if (session.workspaceOnboardingCompleted) throw redirect({ to: '/' });
  },
  component: OnboardingWizard,
});
