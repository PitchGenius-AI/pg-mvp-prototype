import { createFileRoute } from '@tanstack/react-router';
import { BuyersIntakePage, intakeSearchSchema } from '../../features/buyers-intake';

// The intake surface (M14, PG-209) — three methods (Structured form, Paste,
// Daily Workbench import) for adding buyers/opportunities. Reached from the
// Workbench "Add opportunity" button and the Buyers "Add buyer" button.
// Supersedes the M4 "Add Opportunity" modal.
export const Route = createFileRoute('/_authed/buyers/new')({
  validateSearch: intakeSearchSchema,
  component: BuyersIntakePage,
});
