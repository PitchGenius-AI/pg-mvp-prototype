import { Badge, Group, SegmentedControl, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import {
  buyerStatusFilters,
  DEFAULT_STATUS_FILTER,
  type BuyerStatusFilter,
  type BuyersSearchParams,
} from './buyers-search';

interface BuyersFiltersProps {
  params: BuyersSearchParams;
  onChange: (next: BuyersSearchParams) => void;
  counts: Record<BuyerStatusFilter, number>;
}

const STATUS_LABELS: Record<BuyerStatusFilter, string> = {
  all: 'All',
  assigned: 'Assigned',
  unassigned: 'Unassigned',
};

// Search + status filter bar for the Buyers directory (PG-205). Status is a
// SegmentedControl carrying live counts; search matches name + company.
export function BuyersFilters({ params, onChange, counts }: BuyersFiltersProps) {
  // Local controlled value so typing stays snappy; URL updates after debounce.
  const [searchValue, setSearchValue] = useState(params.q ?? '');
  const [debounced] = useDebouncedValue(searchValue, 200);

  useEffect(() => {
    const normalized = debounced.trim();
    if (normalized === (params.q ?? '').trim()) return;
    onChange({ ...params, q: normalized.length > 0 ? normalized : undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const status = params.status ?? DEFAULT_STATUS_FILTER;

  return (
    <Group gap="sm" wrap="wrap" align="center" justify="space-between">
      <TextInput
        placeholder="Search buyers, companies…"
        leftSection={<IconSearch size={14} />}
        value={searchValue}
        onChange={(e) => setSearchValue(e.currentTarget.value)}
        w={280}
      />
      <SegmentedControl
        value={status}
        onChange={(value) =>
          onChange({
            ...params,
            status:
              (value as BuyerStatusFilter) === DEFAULT_STATUS_FILTER
                ? undefined
                : (value as BuyerStatusFilter),
          })
        }
        data={buyerStatusFilters.map((value) => ({
          value,
          label: (
            <Group gap={6} wrap="nowrap">
              <Text size="sm">{STATUS_LABELS[value]}</Text>
              <Badge size="xs" variant="light" color="gray">
                {counts[value]}
              </Badge>
            </Group>
          ),
        }))}
      />
    </Group>
  );
}
