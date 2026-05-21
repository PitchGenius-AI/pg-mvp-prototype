import { createFileRoute } from '@tanstack/react-router';
import { BuyersIntakePage, intakeSearchSchema } from '../../features/buyers-intake';

// The intake surface (M14, PG-209; +M15 PG-216) — four methods (Structured
// form, Paste, Daily Workbench import, Activity history) for adding
// buyers/opportunities and backfilling their activity history. Reached from the
// Workbench "Add opportunity" button and the Buyers "Add buyer" button.
// Supersedes the M4 "Add Opportunity" modal.
export const Route = createFileRoute('/_authed/buyers/new')({
  validateSearch: intakeSearchSchema,
  component: BuyersIntakePage,
});
