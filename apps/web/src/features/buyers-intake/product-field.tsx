import { Group, Select, Text } from '@mantine/core';
import { IconPackage } from '@tabler/icons-react';
import { useMemo } from 'react';
import type { MockProduct } from '../../mock/types';

interface ProductFieldProps {
  products: MockProduct[];
  value: string | null;
  onChange: (productId: string) => void;
}

// Product picker for the single-opportunity intake methods (PG-210). The product
// anchors every readiness diagnosis, so it is always assigned here — never
// deferred. With one product it collapses to a read-only line (nothing to
// choose); with several it is a Select defaulted to the primary.
export function ProductField({ products, value, onChange }: ProductFieldProps) {
  // Primary first, then alphabetical — the order a rep scans for the right one.
  const ordered = useMemo(
    () =>
      [...products].sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [products],
  );

  if (ordered.length === 0) return null;

  if (ordered.length === 1) {
    const only = ordered[0];
    if (!only) return null;
    return (
      <Group gap={6} wrap="nowrap">
        <IconPackage size={15} color="var(--mantine-color-dimmed)" />
        <Text size="sm" c="dimmed">
          Product:
        </Text>
        <Text size="sm" fw={600}>
          {only.name}
        </Text>
      </Group>
    );
  }

  return (
    <Select
      label="Product"
      description="Every readiness diagnosis is anchored to this product."
      data={ordered.map((p) => ({
        value: p.id,
        label: p.isPrimary ? `${p.name} (primary)` : p.name,
      }))}
      value={value}
      onChange={(next) => next && onChange(next)}
      allowDeselect={false}
      leftSection={<IconPackage size={16} />}
      required
    />
  );
}
