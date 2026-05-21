import { createFileRoute } from '@tanstack/react-router';
import { OverlayMockPage } from '../../features/copilot';

// The in-call overlay design mock (M20, PG-238/239) — `/copilot/overlay`. A
// static gallery of the Live Co-pilot desktop app's in-call overlay states.
// The trailing `_` on `copilot_` un-nests this from the `/copilot` route so
// that screen stays a leaf; this page is reached from a link on it, not the
// sidebar. Session + paywall gating happen in the `_authed` layout.
export const Route = createFileRoute('/_authed/copilot_/overlay')({
  component: OverlayMockPage,
});
