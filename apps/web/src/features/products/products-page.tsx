import {
  Badge,
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconStar } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import {
  useCurrentWorkspace,
  useProducts,
  useSetPrimaryProduct,
} from '../../mock/hooks';
import type { MockProduct } from '../../mock/types';
import { ProductFormModal } from './product-form-modal';
import { ProductsEmpty, ProductsError, ProductsLoading } from './products-states';

// The Products management page (M16, PG-219) — the post-onboarding home for the
// products set up in onboarding step 5. List, add, edit, and set-primary; no
// deletion in MVP. Every readiness diagnosis is anchored to a product's context.
export function ProductsPage() {
  const { data: workspace } = useCurrentWorkspace();
  const products = useProducts();
  const setPrimary = useSetPrimaryProduct();

  const [modalOpen, { open, close }] = useDisclosure(false);
  // The product being edited; null → the modal is in add mode.
  const [editing, setEditing] = useState<MockProduct | null>(null);
  // The product mid-promotion, so its row action shows a spinner.
  const [promotingId, setPromotingId] = useState<string | null>(null);

  // Primary first, then alphabetical — a stable order the rep can scan.
  const sorted = useMemo(() => {
    const list = products.data ?? [];
    return [...list].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [products.data]);

  const openAdd = () => {
    setEditing(null);
    open();
  };

  const openEdit = (product: MockProduct) => {
    setEditing(product);
    open();
  };

  const handleSetPrimary = (product: MockProduct) => {
    setPromotingId(product.id);
    setPrimary.mutate(product.id, {
      onSuccess: () => {
        notifications.show({
          color: 'teal',
          title: 'Primary product updated',
          message: `${product.name} is now the default for new opportunities.`,
        });
      },
      onSettled: () => setPromotingId(null),
    });
  };

  return (
    <Container size="lg" py="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Stack gap={2}>
            <Title order={2}>Products</Title>
            <Text size="sm" c="dimmed">
              What you sell. Every readiness diagnosis is anchored to a product's context — your
              primary product is the default for new opportunities.
            </Text>
          </Stack>
          {sorted.length > 0 && (
            <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>
              Add product
            </Button>
          )}
        </Group>

        {products.isPending ? (
          <ProductsLoading />
        ) : products.isError ? (
          <ProductsError onRetry={() => void products.refetch()} />
        ) : sorted.length === 0 ? (
          <ProductsEmpty onAdd={openAdd} />
        ) : (
          <Stack gap="md">
            {sorted.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={() => openEdit(product)}
                onSetPrimary={() => handleSetPrimary(product)}
                promoting={promotingId === product.id}
                promoteDisabled={setPrimary.isPending}
              />
            ))}
          </Stack>
        )}
      </Stack>

      {workspace && (
        <ProductFormModal
          opened={modalOpen}
          onClose={close}
          workspaceId={workspace.id}
          product={editing}
        />
      )}
    </Container>
  );
}

function ProductCard({
  product,
  onEdit,
  onSetPrimary,
  promoting,
  promoteDisabled,
}: {
  product: MockProduct;
  onEdit: () => void;
  onSetPrimary: () => void;
  promoting: boolean;
  promoteDisabled: boolean;
}) {
  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
          <Group gap="xs" align="center" wrap="wrap">
            <Text fw={600} size="lg">
              {product.name}
            </Text>
            {product.isPrimary && (
              <Badge variant="light" leftSection={<IconStar size={11} />}>
                Primary
              </Badge>
            )}
          </Group>
          <Group gap="xs" wrap="nowrap">
            {!product.isPrimary && (
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconStar size={14} />}
                onClick={onSetPrimary}
                loading={promoting}
                disabled={promoteDisabled && !promoting}
              >
                Set as primary
              </Button>
            )}
            <Button size="xs" variant="default" onClick={onEdit}>
              Edit
            </Button>
          </Group>
        </Group>

        <Text size="sm">{product.description}</Text>

        <Group align="flex-start" gap="xl" wrap="wrap">
          <Stack gap={2} style={{ flex: '1 1 220px' }}>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Who it's for
            </Text>
            <Text size="sm">{product.targetBuyer}</Text>
          </Stack>
          <Stack gap={2} style={{ flex: '1 1 220px' }}>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Problem it solves
            </Text>
            <Text size="sm">{product.problemSolved}</Text>
          </Stack>
        </Group>
      </Stack>
    </Paper>
  );
}
