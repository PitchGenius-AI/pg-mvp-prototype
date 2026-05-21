import { createFileRoute } from '@tanstack/react-router';
import { BuyersPage, buyersSearchSchema } from '../../features/buyers';

// The Buyers people directory (M13, PG-205–208). The Workbench's
// unassigned-buyers banner deep-links here pre-filtered to Unassigned via the
// `status` search param.
export const Route = createFileRoute('/_authed/buyers')({
  validateSearch: buyersSearchSchema,
  component: BuyersPage,
});
