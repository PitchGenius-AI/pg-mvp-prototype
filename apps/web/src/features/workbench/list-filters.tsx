import { alignmentOutcomes, readinessStates } from '@pg/shared';
import { Button, Group, MultiSelect, Select, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconAlertTriangle, IconSearch } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import type { MockProduct } from '../../mock/types';
import { ALIGNMENT_LABELS, READINESS_LABELS } from './workbench-data';
import { hasActiveFilters, type WorkbenchSearchParams } from './workbench-search';

interface ListFiltersProps {
  params: WorkbenchSearchParams;
  onChange: (next: WorkbenchSearchParams) => void;
  stages: string[];
  products: MockProduct[];
}

// Filter bar for the List view (PG-202). The headline control is the
// "Over-projecting only" toggle — the deals a rep most needs to see — kept
// visually distinct from the secondary stage / readiness / product filters.
export function ListFilters({ params, onChange, stages, products }: ListFiltersProps) {
  // Local controlled value so typing stays snappy; URL updates after debounce.
  const [searchValue, setSearchValue] = useState(params.q ?? '');
  const [debounced] = useDebouncedValue(searchValue, 200);

  useEffect(() => {
    const normalized = debounced.trim();
    if (normalized === (params.q ?? '').trim()) return;
    onChange({ ...params, q: normalized.length > 0 ? normalized : undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const overProjecting = params.alignment === 'over_projecting';
  const active = hasActiveFilters(params);

  return (
    <Group gap="sm" wrap="wrap" align="flex-end">
      <TextInput
        placeholder="Search buyers, companies, deals…"
        leftSection={<IconSearch size={14} />}
        value={searchValue}
        onChange={(e) => setSearchValue(e.currentTarget.value)}
        w={260}
      />

      <Button
        size="sm"
        variant={overProjecting ? 'filled' : 'default'}
        color="red"
        leftSection={<IconAlertTriangle size={15} />}
        onClick={() =>
          onChange({ ...params, alignment: overProjecting ? undefined : 'over_projecting' })
        }
      >
        Over-projecting only
      </Button>

      <Select
        size="sm"
        w={150}
        placeholder="CRM stage"
        clearable
        data={stages.map((s) => ({ value: s, label: s }))}
        value={params.stage ?? null}
        onChange={(value) => onChange({ ...params, stage: value ?? undefined })}
      />

      <MultiSelect
        size="sm"
        w={210}
        placeholder="Readiness"
        clearable
        searchable
        data={readinessStates.map((s) => ({ value: s, label: READINESS_LABELS[s] }))}
        value={params.readiness ?? []}
        onChange={(value) =>
          onChange({
            ...params,
            readiness:
              value.length > 0 ? (value as WorkbenchSearchParams['readiness']) : undefined,
          })
        }
      />

      <Select
        size="sm"
        w={160}
        placeholder="Alignment"
        clearable
        data={alignmentOutcomes.map((o) => ({ value: o, label: ALIGNMENT_LABELS[o] }))}
        value={params.alignment ?? null}
        onChange={(value) =>
          onChange({
            ...params,
            alignment: (value as WorkbenchSearchParams['alignment']) ?? undefined,
          })
        }
      />

      {products.length > 1 && (
        <Select
          size="sm"
          w={170}
          placeholder="Product"
          clearable
          data={products.map((p) => ({ value: p.id, label: p.name }))}
          value={params.product ?? null}
          onChange={(value) => onChange({ ...params, product: value ?? undefined })}
        />
      )}

      {active && (
        <Button
          size="sm"
          variant="subtle"
          color="gray"
          onClick={() => onChange({ sort: params.sort, dir: params.dir })}
        >
          Clear filters
        </Button>
      )}
    </Group>
  );
}
