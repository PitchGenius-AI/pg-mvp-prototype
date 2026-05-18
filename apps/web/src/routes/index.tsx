import { createFileRoute, redirect } from '@tanstack/react-router';
import { useMockStore } from '../mock/store';

// `/` is a pure gate: where the user lands depends on session + onboarding state.
// Pushed into beforeLoad so the redirect happens before render.
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const session = useMockStore.getState().session;
    if (!session) throw redirect({ to: '/login' });
    if (!session.workspaceOnboardingCompleted) throw redirect({ to: '/onboarding' });
    throw redirect({ to: '/opportunities' });
  },
});
