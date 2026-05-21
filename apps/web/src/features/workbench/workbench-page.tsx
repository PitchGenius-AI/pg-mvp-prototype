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
import { useBuyers, useProducts, useWorkbench } from '../../mock/hooks';
import { useWorkspaceStages } from '../../mock/use-workspace-stages';
import { AddOpportunityModal } from '../opportunity-intake';
import { BoardView } from './board-view';
import { ListFilters } from './list-filters';
import { ListView } from './list-view';
import { UnassignedBanner } from './unassigned-banner';
import { useWorkbenchView, type WorkbenchView } from './use-workbench-view';
import { filterRows, sortRows } from './workbench-data';
import { DEFAULT_DIR, DEFAULT_SORT, type SortColumn, type SortDir } from './workbench-search';
import {
  WorkbenchEmpty,
  WorkbenchError,
  WorkbenchFilteredEmpty,
  WorkbenchLoading,
} from './workbench-states';

const routeApi = getRouteApi('/_authed/');

// The Opportunity Workbench (M12) — the rep's home screen. Hosts two views of
// the same opportunities (Board / List) behind a per-user toggle, with the
// unassigned-buyers banner and empty / loading / error states.
export function WorkbenchPage() {
  const params = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const [view, setView] = useWorkbenchView();
  const [addOpen, setAddOpen] = useState(false);

  const workbench = useWorkbench();
  const buyers = useBuyers();
  const products = useProducts();
  const stages = useWorkspaceStages();

  const rows = useMemo(() => workbench.data ?? [], [workbench.data]);
  const showProduct = (products.data?.length ?? 0) > 1;
  const sort = params.sort ?? DEFAULT_SORT;
  const dir = params.dir ?? DEFAULT_DIR;

  // List-view filtering + sorting. Cheap, and the Board view ignores the result.
  const filteredRows = useMemo(() => filterRows(rows, params), [rows, params]);
  const sortedRows = useMemo(
    () => sortRows(filteredRows, sort, dir, stages),
    [filteredRows, sort, dir, stages],
  );

  // A buyer with no opportunity is "unassigned" — surfaced via the banner.
  const unassignedCount = useMemo(() => {
    const assigned = new Set(rows.map((r) => r.opportunity.buyerId));
    return (buyers.data ?? []).filter((b) => !assigned.has(b.id)).length;
  }, [rows, buyers.data]);

  const updateParams = (next: typeof params) => {
    navigate({ search: next, replace: true });
  };

  const handleSort = (column: SortColumn) => {
    if (column === sort) {
      updateParams({ ...params, dir: dir === 'asc' ? 'desc' : 'asc' });
    } else {
      updateParams({ ...params, sort: column, dir: defaultDirFor(column) });
    }
  };

  return (
    <Container size="xl" py="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Stack gap={2}>
            <Title order={2}>Opportunity Workbench</Title>
            <Text size="sm" c="dimmed">
              Your daily cockpit — every open deal, scored against the buyer's evidence.
            </Text>
          </Stack>
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
            <Button leftSection={<IconPlus size={16} />} onClick={() => setAddOpen(true)}>
              Add opportunity
            </Button>
          </Group>
        </Group>

        {workbench.isPending ? (
          <WorkbenchLoading view={view} />
        ) : workbench.isError ? (
          <WorkbenchError onRetry={() => void workbench.refetch()} />
        ) : rows.length === 0 ? (
          <WorkbenchEmpty
            onAdd={() => setAddOpen(true)}
            onImport={() => setAddOpen(true)}
          />
        ) : (
          <Stack gap="md">
            <UnassignedBanner count={unassignedCount} />

            {view === 'board' ? (
              <BoardView rows={rows} stages={stages} showProduct={showProduct} />
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
                    onClear={() => updateParams({ sort: params.sort, dir: params.dir })}
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

      <AddOpportunityModal opened={addOpen} onClose={() => setAddOpen(false)} />
    </Container>
  );
}

// Text columns read naturally ascending; severity / score / recency columns
// open with the most-pressing rows first.
function defaultDirFor(column: SortColumn): SortDir {
  return column === 'buyer' ||
    column === 'company' ||
    column === 'product' ||
    column === 'stage'
    ? 'asc'
    : 'desc';
}
