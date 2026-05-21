import { Button, Container, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconX } from '@tabler/icons-react';
import { getRouteApi } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useAssignBuyersToProduct, useBuyerDirectory, useProducts } from '../../mock/hooks';
import { AssignProductControl } from './assign-product-control';
import { filterBuyerRows } from './buyers-data';
import { BuyersFilters } from './buyers-filters';
import { DEFAULT_STATUS_FILTER } from './buyers-search';
import {
  BuyersEmpty,
  BuyersError,
  BuyersFilteredEmpty,
  BuyersLoading,
  BuyersUnassignedEmpty,
} from './buyers-states';
import { BuyersTable } from './buyers-table';

const routeApi = getRouteApi('/_authed/buyers/');

// The Buyers people directory (M13) — every buyer in the workspace, with the
// product-assignment workflow the Workbench's unassigned-buyers banner points
// to. Assigning a product turns an unassigned buyer into an opportunity.
export function BuyersPage() {
  const params = routeApi.useSearch();
  const navigate = routeApi.useNavigate();

  const directory = useBuyerDirectory();
  const products = useProducts();
  const assign = useAssignBuyersToProduct();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Tracks the buyer mid-assignment so its row action shows a spinner and the
  // other rows' actions disable — one assignment resolves at a time.
  const [assigningBuyerId, setAssigningBuyerId] = useState<string | null>(null);

  const rows = useMemo(() => directory.data ?? [], [directory.data]);
  const status = params.status ?? DEFAULT_STATUS_FILTER;

  const counts = useMemo(
    () => ({
      all: rows.length,
      assigned: rows.filter((r) => r.status === 'assigned').length,
      unassigned: rows.filter((r) => r.status === 'unassigned').length,
    }),
    [rows],
  );

  const filteredRows = useMemo(() => filterBuyerRows(rows, params), [rows, params]);

  // Selection is scoped to the unassigned buyers currently visible — the only
  // rows the bulk assignment acts on. Stale ids (a buyer just assigned, or
  // filtered out) drop out here without needing to mutate selection state.
  const visibleUnassignedIds = useMemo(
    () => filteredRows.filter((r) => r.status === 'unassigned').map((r) => r.buyer.id),
    [filteredRows],
  );
  const effectiveSelected = useMemo(() => {
    const visible = new Set(visibleUnassignedIds);
    return new Set([...selectedIds].filter((id) => visible.has(id)));
  }, [selectedIds, visibleUnassignedIds]);

  const updateParams = (next: typeof params) => {
    navigate({ search: next, replace: true });
  };

  const handleToggleRow = (buyerId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(buyerId)) next.delete(buyerId);
      else next.add(buyerId);
      return next;
    });
  };

  const handleToggleAll = (select: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of visibleUnassignedIds) {
        if (select) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const runAssign = (buyerIds: string[], productId: string) => {
    if (buyerIds.length === 0) return;
    if (buyerIds.length === 1) setAssigningBuyerId(buyerIds[0] ?? null);
    assign.mutate(
      { buyerIds, productId },
      {
        onSuccess: (created) => {
          if (created.length === 0) {
            notifications.show({
              color: 'red',
              title: 'Assignment failed',
              message: 'Those buyers could not be assigned. Refresh and try again.',
            });
            return;
          }
          const n = created.length;
          notifications.show({
            color: 'teal',
            title: 'Product assigned',
            message: `${n} ${n === 1 ? 'buyer is' : 'buyers are'} now ${
              n === 1 ? 'an opportunity' : 'opportunities'
            } on your workbench.`,
          });
          setSelectedIds(new Set());
        },
        onSettled: () => setAssigningBuyerId(null),
      },
    );
  };

  const selectedCount = effectiveSelected.size;

  return (
    <Container size="xl" py="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Stack gap={2}>
            <Title order={2}>Buyers</Title>
            <Text size="sm" c="dimmed">
              Everyone you sell to. Assign a product to anyone still waiting to start tracking
              them on your workbench.
            </Text>
          </Stack>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate({ to: '/buyers/new' })}
          >
            Add buyer
          </Button>
        </Group>

        {directory.isPending ? (
          <BuyersLoading />
        ) : directory.isError ? (
          <BuyersError onRetry={() => void directory.refetch()} />
        ) : rows.length === 0 ? (
          <BuyersEmpty />
        ) : (
          <Stack gap="md">
            <BuyersFilters params={params} onChange={updateParams} counts={counts} />

            {selectedCount > 0 && (
              <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-blue-light)">
                <Group justify="space-between" wrap="wrap" gap="sm">
                  <Text size="sm" fw={600}>
                    {selectedCount} {selectedCount === 1 ? 'buyer' : 'buyers'} selected
                  </Text>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="subtle"
                      color="gray"
                      leftSection={<IconX size={14} />}
                      onClick={() => setSelectedIds(new Set())}
                    >
                      Clear selection
                    </Button>
                    <AssignProductControl
                      products={products.data ?? []}
                      label="Assign selected to product"
                      size="sm"
                      variant="filled"
                      loading={assign.isPending && assigningBuyerId === null}
                      onAssign={(productId) => runAssign([...effectiveSelected], productId)}
                    />
                  </Group>
                </Group>
              </Paper>
            )}

            {filteredRows.length === 0 ? (
              status === 'unassigned' && !params.q?.trim() ? (
                <BuyersUnassignedEmpty onShowAll={() => updateParams({})} />
              ) : (
                <BuyersFilteredEmpty
                  message={
                    params.q?.trim()
                      ? `No buyers match “${params.q.trim()}”. Try a different search.`
                      : 'No buyers are assigned to a product yet.'
                  }
                  onClear={() => updateParams({})}
                />
              )
            ) : (
              <BuyersTable
                rows={filteredRows}
                products={products.data ?? []}
                selectedIds={effectiveSelected}
                onToggleRow={handleToggleRow}
                onToggleAll={handleToggleAll}
                onAssign={runAssign}
                assigningBuyerId={assigningBuyerId}
                assignBusy={assign.isPending}
              />
            )}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
