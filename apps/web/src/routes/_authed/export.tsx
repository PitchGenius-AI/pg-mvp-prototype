import { createFileRoute } from '@tanstack/react-router';
import { ExportPackPage } from '../../features/export';

// The CRM Update Pack (M18) — the end-of-day bulk export at `/export`, bookend
// to the morning Daily Workbench import. Session, onboarding, and paywall
// gating all happen in the `_authed` layout's beforeLoad.
export const Route = createFileRoute('/_authed/export')({
  component: ExportPackPage,
});
