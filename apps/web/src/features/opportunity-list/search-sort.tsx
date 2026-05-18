import { Group, Select, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import {
  DEFAULT_SORT,
  SORT_LABELS,
  sortOptions,
  type ListSearchParams,
  type SortOption,
} from './search-schema';

interface SearchSortProps {
  params: ListSearchParams;
  onChange: (next: ListSearchParams) => void;
}

export function SearchSort({ params, onChange }: SearchSortProps) {
  // Local controlled value so typing stays snappy; URL only updates after debounce.
  const [searchValue, setSearchValue] = useState(params.q ?? '');
  const [debounced] = useDebouncedValue(searchValue, 200);

  useEffect(() => {
    const normalized = debounced.trim();
    const current = (params.q ?? '').trim();
    if (normalized === current) return;
    onChange({ ...params, q: normalized.length > 0 ? normalized : undefined });
  }, [debounced]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleSort = (value: string | null) => {
    if (!value) return;
    const next = value as SortOption;
    onChange({ ...params, sort: next === DEFAULT_SORT ? undefined : next });
  };

  return (
    <Group justify="space-between" gap="md" wrap="wrap">
      <TextInput
        placeholder="Search opportunities, buyers, companies…"
        leftSection={<IconSearch size={14} />}
        value={searchValue}
        onChange={(e) => setSearchValue(e.currentTarget.value)}
        w={320}
      />
      <Select
        size="sm"
        w={240}
        data={sortOptions.map((option) => ({
          value: option,
          label: SORT_LABELS[option],
        }))}
        value={params.sort ?? DEFAULT_SORT}
        onChange={handleSort}
        allowDeselect={false}
      />
    </Group>
  );
}
