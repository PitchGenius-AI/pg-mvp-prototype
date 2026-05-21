import { Badge, Button, Group, Menu, Text } from '@mantine/core';
import { IconChevronDown, IconPackage } from '@tabler/icons-react';
import type { MockProduct } from '../../mock/types';

interface AssignProductControlProps {
  products: MockProduct[];
  onAssign: (productId: string) => void;
  label: string;
  size?: 'xs' | 'sm';
  variant?: string;
  loading?: boolean;
  disabled?: boolean;
}

// Product picker shared by per-buyer (PG-206) and bulk (PG-207) assignment.
// A buyer with no product is unassigned; picking a product here turns it into
// an opportunity. The primary product is listed first and labelled, since it is
// the default deal context for the multi-product rep.
export function AssignProductControl({
  products,
  onAssign,
  label,
  size = 'xs',
  variant = 'light',
  loading = false,
  disabled = false,
}: AssignProductControlProps) {
  // Primary first, then alphabetical — the order a rep scans for the right one.
  const ordered = [...products].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <Menu position="bottom-end" withinPortal shadow="md" width={260}>
      <Menu.Target>
        <Button
          size={size}
          variant={variant}
          loading={loading}
          disabled={disabled || ordered.length === 0}
          leftSection={<IconPackage size={size === 'xs' ? 14 : 16} />}
          rightSection={<IconChevronDown size={size === 'xs' ? 13 : 15} />}
        >
          {label}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Assign to product</Menu.Label>
        {ordered.map((product) => (
          <Menu.Item key={product.id} onClick={() => onAssign(product.id)}>
            <Group justify="space-between" wrap="nowrap" gap="sm">
              <Text size="sm" lineClamp={1}>
                {product.name}
              </Text>
              {product.isPrimary && (
                <Badge size="xs" variant="light" color="gray">
                  Primary
                </Badge>
              )}
            </Group>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
