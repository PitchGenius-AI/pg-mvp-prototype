import { createFileRoute } from '@tanstack/react-router';
import { CopilotPage } from '../../features/copilot';

// The Live Co-pilot's web home (M19, PG-233) — `/copilot`. The screen renders
// by install state (download → connect → launch). Session, onboarding, and
// paywall gating all happen in the `_authed` layout's beforeLoad.
export const Route = createFileRoute('/_authed/copilot')({
  component: CopilotPage,
});
