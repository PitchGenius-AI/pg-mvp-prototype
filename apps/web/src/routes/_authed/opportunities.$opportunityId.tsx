import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { DetailPage } from '../../features/opportunity-detail/detail-page';
import {
  detailSearchSchema,
  type DetailTab,
} from '../../features/opportunity-detail/detail-search';

export const Route = createFileRoute('/_authed/opportunities/$opportunityId')({
  validateSearch: detailSearchSchema,
  component: OpportunityDetailRoute,
});

function OpportunityDetailRoute() {
  const { opportunityId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const handleTabChange = (next: DetailTab) => {
    navigate({ search: { tab: next }, replace: true });
  };

  return (
    <DetailPage opportunityId={opportunityId} tab={tab} onTabChange={handleTabChange} />
  );
}
