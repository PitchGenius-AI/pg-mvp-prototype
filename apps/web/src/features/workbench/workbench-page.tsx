import {
  Button,
  Center,
  Container,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconLayoutKanban, IconList, IconPlus } from '@tabler/icons-react';
import { getRouteApi } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import {
  DEFAULT_PERIOD,
  filterByPeriod,
  periodCounts,
  type WorkbenchPeriod,
} from '../../lib/period';
import { useBuyers, useProducts, useWorkbench } from '../../mock/hooks';
import { useWorkspaceStages } from '../../mock/use-workspace-stages';
import { BoardView } from './board-view';
import { CadenceHelp } from './daily-loop';
import { ListFilters } from './list-filters';
import { ListView } from './list-view';
import { NoActivityBanner } from './no-activity-banner';
import { PeriodFilter } from './period-filter';
import { UnassignedBanner } from './unassigned-banner';
import { useWorkbenchView, type WorkbenchView } from './use-workbench-view';
import { filterRows, sortRows } from './workbench-data';
import { DEFAULT_DIR, DEFAULT_SORT, type SortColumn, type SortDir } from './workbench-search';
import {
  WorkbenchEmpty,
  WorkbenchError,
  WorkbenchFilteredEmpty,
  WorkbenchLoading,
  WorkbenchPeriodEmpty,
} from './workbench-states';

const routeApi = getRouteApi('/_authed/');

// The Opportunity Workbench (M12) — the rep's home screen. Hosts two views of
// the same opportunities (Board / List) behind a per-user toggle, with the
// unassigned-buyers banner and empty / loading / error states.
export function WorkbenchPage() {
  const params = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const [view, setView] = useWorkbenchView();
  // Banners are dismissible for the session — once a rep acknowledges the nudge
  // they shouldn't have to keep seeing it while they work the list.
  const [unassignedDismissed, setUnassignedDismissed] = useState(false);
  const [noActivityDismissed, setNoActivityDismissed] = useState(false);

  const workbench = useWorkbench();
  const buyers = useBuyers();
  const products = useProducts();
  const stages = useWorkspaceStages();

  const rows = useMemo(() => workbench.data ?? [], [workbench.data]);
  const showProduct = (products.data?.length ?? 0) > 1;
  // The daily-loop empty state teaches the cadence inline; once the rep has
  // opportunities, the same cadence lives behind the header help affordance.
  const hasOpportunities = !workbench.isPending && !workbench.isError && rows.length > 0;
  const sort = params.sort ?? DEFAULT_SORT;
  const dir = params.dir ?? DEFAULT_DIR;
  const period = params.period ?? DEFAULT_PERIOD;

  // The top-level recency scope (Today by default) gates the rows feeding BOTH
  // Board and List — "what am I working in this window". The List's secondary
  // filters then narrow this result; the Board renders it directly.
  const scopedRows = useMemo(
    () => filterByPeriod(rows, (r) => r.lastActiveAt, period),
    [rows, period],
  );
  // Counts across all rows so each bucket shows its size regardless of the
  // current scope.
  const counts = useMemo(() => periodCounts(rows, (r) => r.lastActiveAt), [rows]);

  // List-view filtering + sorting. Cheap, and the Board view ignores the result.
  const filteredRows = useMemo(() => filterRows(scopedRows, params), [scopedRows, params]);
  const sortedRows = useMemo(
    () => sortRows(filteredRows, sort, dir, stages),
    [filteredRows, sort, dir, stages],
  );

  // A buyer with no opportunity is "unassigned" — surfaced via the banner.
  const unassignedCount = useMemo(() => {
    const assigned = new Set(rows.map((r) => r.opportunity.buyerId));
    return (buyers.data ?? []).filter((b) => !assigned.has(b.id)).length;
  }, [rows, buyers.data]);

  // Opportunities with no activity score only provisionally (M15) — the banner
  // nudges the rep to add or import activity history. Counted within the current
  // scope so the banner matches what's on screen.
  const noActivityCount = useMemo(
    () => scopedRows.filter((r) => r.activityCount === 0).length,
    [scopedRows],
  );

  const updateParams = (next: typeof params) => {
    navigate({ search: next, replace: true });
  };

  // Keep the URL canonical: the default (Today) is omitted rather than written.
  const setPeriod = (next: WorkbenchPeriod) =>
    updateParams({ ...params, period: next === DEFAULT_PERIOD ? undefined : next });

  const handleSort = (column: SortColumn) => {
    if (column === sort) {
      updateParams({ ...params, dir: dir === 'asc' ? 'desc' : 'asc' });
    } else {
      updateParams({ ...params, sort: column, dir: defaultDirFor(column) });
    }
  };

  return (
    <Container fluid py="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Stack gap={4} align="flex-start">
            <Title order={2}>Opportunity Workbench</Title>
            <Text size="sm" c="dimmed" maw={640}>
              Every deal you're working, and where each buyer actually stands. An opportunity is one
              buyer + one product — add a new one any time.
            </Text>
            {hasOpportunities && <CadenceHelp />}
          </Stack>
          {/* The view toggle + Add button only make sense once there are
              opportunities; in the empty state the daily-loop owns the CTAs. */}
          {hasOpportunities && (
            <Group gap="sm">
              <SegmentedControl
                value={view}
                onChange={(value) => setView(value as WorkbenchView)}
                data={[
                  {
                    value: 'board',
                    label: (
                      <Center style={{ gap: 6 }}>
                        <IconLayoutKanban size={15} />
                        <span>Board</span>
                      </Center>
                    ),
                  },
                  {
                    value: 'list',
                    label: (
                      <Center style={{ gap: 6 }}>
                        <IconList size={15} />
                        <span>List</span>
                      </Center>
                    ),
                  },
                ]}
              />
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => navigate({ to: '/buyers/new' })}
              >
                Add opportunity
              </Button>
            </Group>
          )}
        </Group>

        {workbench.isPending ? (
          <WorkbenchLoading view={view} />
        ) : workbench.isError ? (
          <WorkbenchError onRetry={() => void workbench.refetch()} />
        ) : rows.length === 0 ? (
          <WorkbenchEmpty
            onImport={() => navigate({ to: '/buyers/new', search: { method: 'import' } })}
            onAddOne={() => navigate({ to: '/buyers/new', search: { method: 'structured' } })}
          />
        ) : (
          <Stack gap="md">
            <PeriodFilter value={period} onChange={setPeriod} counts={counts} />

            <UnassignedBanner
              count={unassignedDismissed ? 0 : unassignedCount}
              onDismiss={() => setUnassignedDismissed(true)}
            />
            <NoActivityBanner
              count={noActivityDismissed ? 0 : noActivityCount}
              onDismiss={() => setNoActivityDismissed(true)}
            />

            {scopedRows.length === 0 ? (
              <WorkbenchPeriodEmpty
                period={period}
                onShowAll={() => setPeriod('all')}
                onImport={() => navigate({ to: '/buyers/new', search: { method: 'import' } })}
              />
            ) : view === 'board' ? (
              <BoardView rows={scopedRows} stages={stages} showProduct={showProduct} />
            ) : (
              <>
                <ListFilters
                  params={params}
                  onChange={updateParams}
                  stages={stages}
                  products={products.data ?? []}
                />
                {sortedRows.length === 0 ? (
                  <WorkbenchFilteredEmpty
                    onClear={() =>
                      updateParams({ sort: params.sort, dir: params.dir, period: params.period })
                    }
                  />
                ) : (
                  <ListView
                    rows={sortedRows}
                    sort={sort}
                    dir={dir}
                    onSort={handleSort}
                    showProduct={showProduct}
                  />
                )}
              </>
            )}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}

// Text columns read naturally ascending; severity / score / recency columns
// open with the most-pressing rows first.
function defaultDirFor(column: SortColumn): SortDir {
  return column === 'buyer' || column === 'company' || column === 'product' || column === 'stage'
    ? 'asc'
    : 'desc';
}
