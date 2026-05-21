import { Button, Group, Modal, Stack, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useAddProduct, useUpdateProduct } from '../../mock/hooks';
import type { MockProduct } from '../../mock/types';

interface ProductFormModalProps {
  opened: boolean;
  onClose: () => void;
  workspaceId: string;
  // Present → edit mode; absent → add mode.
  product?: MockProduct | null;
}

// Add / edit a product. Captures the four fields a readiness diagnosis is
// anchored to — name, description, who it's for, the problem it solves.
// Setting the primary product is a separate per-card action (see ProductsPage),
// so this form never touches `isPrimary`.
export function ProductFormModal({
  opened,
  onClose,
  workspaceId,
  product,
}: ProductFormModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={product ? 'Edit product' : 'Add product'}
      size="lg"
      centered
    >
      {/* Keyed so each open starts from fresh form state for the right product. */}
      {opened && (
        <ProductFormBody
          key={product?.id ?? 'new'}
          workspaceId={workspaceId}
          product={product}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function ProductFormBody({
  workspaceId,
  product,
  onClose,
}: {
  workspaceId: string;
  product?: MockProduct | null;
  onClose: () => void;
}) {
  const addProduct = useAddProduct();
  const updateProduct = useUpdateProduct();

  const form = useForm({
    initialValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      targetBuyer: product?.targetBuyer ?? '',
      problemSolved: product?.problemSolved ?? '',
    },
    validate: {
      name: (v) => (v.trim().length > 0 ? null : 'Required'),
      description: (v) => (v.trim().length > 0 ? null : 'Required'),
      targetBuyer: (v) => (v.trim().length > 0 ? null : 'Required'),
      problemSolved: (v) => (v.trim().length > 0 ? null : 'Required'),
    },
  });

  const submit = form.onSubmit((values) => {
    const fields = {
      name: values.name.trim(),
      description: values.description.trim(),
      targetBuyer: values.targetBuyer.trim(),
      problemSolved: values.problemSolved.trim(),
    };
    if (product) {
      updateProduct.mutate(
        { productId: product.id, patch: fields },
        {
          onSuccess: () => {
            notifications.show({
              color: 'teal',
              title: 'Product updated',
              message: `${fields.name} has been saved.`,
            });
            onClose();
          },
        },
      );
    } else {
      addProduct.mutate(
        { workspaceId, product: fields },
        {
          onSuccess: () => {
            notifications.show({
              color: 'teal',
              title: 'Product added',
              message: `${fields.name} is now in your workspace.`,
            });
            onClose();
          },
        },
      );
    }
  });

  const pending = addProduct.isPending || updateProduct.isPending;

  return (
    <form onSubmit={submit}>
      <Stack gap="md">
        <TextInput
          label="Product name"
          placeholder="e.g. Pulse"
          withAsterisk
          autoFocus
          {...form.getInputProps('name')}
        />
        <Textarea
          label="Description"
          description="A sentence on what it is and what it does."
          placeholder="What the product is and what it does."
          withAsterisk
          autosize
          minRows={2}
          maxRows={5}
          {...form.getInputProps('description')}
        />
        <Textarea
          label="Who it's for"
          description="The buyer persona and company profile you sell this to."
          placeholder="The roles, seniority, and company type you sell this to."
          withAsterisk
          autosize
          minRows={2}
          maxRows={5}
          {...form.getInputProps('targetBuyer')}
        />
        <Textarea
          label="Problem it solves"
          description="The pain this product addresses — readiness diagnoses use this context."
          placeholder="The pain or gap this product addresses for the buyer."
          withAsterisk
          autosize
          minRows={2}
          maxRows={5}
          {...form.getInputProps('problemSolved')}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {product ? 'Save changes' : 'Add product'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
