import { createFileRoute } from '@tanstack/react-router';
import { ScriptsPage } from '../../features/scripts';

// The Call Scripts management page (M16, PG-220) — the editing home for the
// workspace's call-script template(s). Add, edit, and set-primary.
export const Route = createFileRoute('/_authed/scripts')({
  component: ScriptsPage,
});
