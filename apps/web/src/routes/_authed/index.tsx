import { createFileRoute } from '@tanstack/react-router';
import { WorkbenchPage, workbenchSearchSchema } from '../../features/workbench';

// The Opportunity Workbench is the authed home screen (`/`). Session,
// onboarding, and paywall gating all happen in the `_authed` layout's
// beforeLoad — by the time this renders the rep is signed in and paid.
export const Route = createFileRoute('/_authed/')({
  validateSearch: workbenchSearchSchema,
  component: WorkbenchPage,
});
