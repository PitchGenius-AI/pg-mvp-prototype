import { createFileRoute, redirect } from '@tanstack/react-router';
import { OnboardingWizard } from '../features/onboarding/wizard';
import { authClient } from '../auth-client';
import { trpcVanilla } from '../trpc';

export const Route = createFileRoute('/onboarding')({
  // Onboarding requires a session even though it sits outside `_authed/`.
  // If onboarding is already complete, hand off to the app.
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (!session) throw redirect({ to: '/login', search: { redirect: '/onboarding' } });
    const current = await trpcVanilla.workspace.getCurrent.query();
    if (current?.workspace.onboardingCompleted) throw redirect({ to: '/' });
  },
  component: OnboardingWizard,
});
