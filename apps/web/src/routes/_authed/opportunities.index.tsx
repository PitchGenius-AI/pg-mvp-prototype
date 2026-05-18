import {
  ActionIcon,
  Button,
  Container,
  Divider,
  Group,
  Popover,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconInfoCircle, IconPlus } from '@tabler/icons-react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { OpportunityListSkeleton } from '../../components/skeletons/opportunity-list-skeleton';
import { AddOpportunityModal } from '../../features/opportunity-intake';
import { EmptyStates, Filters, OpportunityList, SearchSort } from '../../features/opportunity-list';
import {
  OPPORTUNITY_CONCEPT_BODY,
  OPPORTUNITY_CONCEPT_HEADING,
} from '../../features/opportunity-list/opportunity-concept-copy';
import {
  applyFilters,
  applySort,
  selectOpportunityRows,
} from '../../features/opportunity-list/filter-sort';
import {
  DEFAULT_SORT,
  hasActiveFilters,
  listSearchSchema,
  type ListSearchParams,
} from '../../features/opportunity-list/search-schema';
import { useCurrentSession } from '../../mock/store';

export const Route = createFileRoute('/_authed/opportunities/')({
  validateSearch: listSearchSchema,
  component: OpportunityListPage,
});

function OpportunityListPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const session = useCurrentSession();
  const [addOpen, setAddOpen] = useState(false);
  // Simulated initial load — store reads are sync, but a brief skeleton frame
  // matches the rest of the app's loading polish and is what the eventual real
  // tRPC fetch will look like.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setHydrated(true), 240);
    return () => window.clearTimeout(t);
  }, []);

  // Read straight from the store. `selectOpportunityRows` joins buyers +
  // latest interaction once and is recomputed only when params change.
  const allRows = useMemo(
    () => (session ? selectOpportunityRows(session.workspaceId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.workspaceId, params],
  );
  const filteredRows = useMemo(() => applyFilters(allRows, params), [allRows, params]);
  const sortedRows = useMemo(
    () => applySort(filteredRows, params.sort ?? DEFAULT_SORT),
    [filteredRows, params.sort],
  );

  const updateParams = (next: ListSearchParams) => {
    navigate({ search: next, replace: true });
  };

  const hasOpportunitiesAtAll = allRows.length > 0;
  const filtered = sortedRows.length > 0;
  const filtersActive = hasActiveFilters(params);

  return (
    <Container size="xl" py="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Stack gap={0}>
            <Group gap={6} align="center">
              <Title order={2}>Opportunities</Title>
              <OpportunityConceptPopover />
            </Group>
            <Text size="sm" c="dimmed">
              {countLabel(sortedRows.length, allRows.length, filtersActive)}
            </Text>
          </Stack>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setAddOpen(true)}>
            Add opportunity
          </Button>
        </Group>

        {!hydrated ? (
          <OpportunityListSkeleton />
        ) : (
          <>
            {hasOpportunitiesAtAll && (
              <>
                <Filters params={params} onChange={updateParams} />
                <Divider />
                <SearchSort params={params} onChange={updateParams} />
              </>
            )}

            {!hasOpportunitiesAtAll && (
              <EmptyStates.NoOpportunitiesEmpty onAdd={() => setAddOpen(true)} />
            )}

            {hasOpportunitiesAtAll && !filtered && (
              <EmptyStates.FilteredEmpty
                onClearFilters={() => updateParams({ sort: params.sort })}
              />
            )}

            {filtered && <OpportunityList rows={sortedRows} />}
          </>
        )}
      </Stack>

      <AddOpportunityModal opened={addOpen} onClose={() => setAddOpen(false)} />
    </Container>
  );
}

function OpportunityConceptPopover() {
  return (
    <Popover width={340} position="bottom-start" withArrow shadow="md">
      <Popover.Target>
        <ActionIcon variant="subtle" color="gray" aria-label="What's an opportunity?">
          <IconInfoCircle size={18} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text fw={600} size="sm">
            {OPPORTUNITY_CONCEPT_HEADING}
          </Text>
          {OPPORTUNITY_CONCEPT_BODY.map((paragraph) => (
            <Text key={paragraph} size="sm">
              {paragraph}
            </Text>
          ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function countLabel(shown: number, total: number, filtersActive: boolean): string {
  if (total === 0) return 'No deals yet';
  if (filtersActive && shown !== total) {
    return `${shown} of ${total} ${total === 1 ? 'deal' : 'deals'}`;
  }
  return `${total} ${total === 1 ? 'deal' : 'deals'}`;
}
