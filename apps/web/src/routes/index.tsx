import { createFileRoute, redirect } from '@tanstack/react-router';
import { hasActiveSubscription } from '../mock/access';
import { useMockStore } from '../mock/store';

// `/` is a pure gate: where the user lands depends on session + onboarding +
// subscription state. Pushed into beforeLoad so the redirect happens before render.
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const { session, workspaces } = useMockStore.getState();
    if (!session) throw redirect({ to: '/login' });
    if (!session.workspaceOnboardingCompleted) throw redirect({ to: '/onboarding' });
    // Hard paywall (M11): onboarded but unpaid → finish onboarding step 11.
    if (!hasActiveSubscription(workspaces[session.workspaceId])) {
      throw redirect({ to: '/checkout' });
    }
    throw redirect({ to: '/opportunities' });
  },
});
