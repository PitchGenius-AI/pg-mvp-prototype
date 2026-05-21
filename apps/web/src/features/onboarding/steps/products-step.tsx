import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Radio,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { newDraftId, type OnboardingDraftProduct } from '../../../mock/types';
import { OnboardingShell } from '../onboarding-shell';
import { onboardingMode, type OnboardingStepProps } from '../types';

// Step 5 (PG-193): confirm the products list. Edit / delete / add, with exactly
// one marked primary — the default product context for new opportunities.

export function productsStepValid(products: OnboardingDraftProduct[]): boolean {
  if (products.length === 0) return false;
  const allFilled = products.every(
    (p) => p.name.trim().length > 0 && p.description.trim().length > 0,
  );
  const primaryCount = products.filter((p) => p.isPrimary).length;
  return allFilled && primaryCount === 1;
}

export function ProductsStep({ step, draft, update, onBack, onContinue }: OnboardingStepProps) {
  const confirming = onboardingMode(draft) === 'confirmation';
  const products = draft.products;
  const primaryId = products.find((p) => p.isPrimary)?.id ?? products[0]?.id ?? '';

  const setProducts = (next: OnboardingDraftProduct[]) => update({ products: next });

  const patchProduct = (id: string, patch: Partial<OnboardingDraftProduct>) =>
    setProducts(products.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const removeProduct = (id: string) => {
    const next = products.filter((p) => p.id !== id);
    // If the primary was removed, promote the first remaining product.
    if (next.length > 0 && !next.some((p) => p.isPrimary)) {
      next[0] = { ...next[0]!, isPrimary: true };
    }
    setProducts(next);
  };

  const addProduct = () =>
    setProducts([
      ...products,
      { id: newDraftId('prod'), name: '', description: '', isPrimary: false },
    ]);

  const setPrimary = (id: string) =>
    setProducts(products.map((p) => ({ ...p, isPrimary: p.id === id })));

  return (
    <OnboardingShell
      step={step}
      title={confirming ? 'Confirm your products' : 'What do you sell?'}
      subtitle={
        confirming
          ? 'We found these on your site — edit, remove, or add more. Mark your main product as primary.'
          : 'Add each product or service you sell. Mark your main one as primary — it’s the default for new opportunities.'
      }
      canContinue={productsStepValid(products)}
      onBack={onBack}
      onContinue={onContinue}
    >
      <Radio.Group value={primaryId} onChange={setPrimary}>
        <Stack gap="sm">
          {products.map((product, index) => (
            <Paper key={product.id} p="md" withBorder radius="md">
              <Stack gap="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Radio
                    value={product.id}
                    label={
                      product.isPrimary ? (
                        <Badge size="xs" variant="light">
                          Primary
                        </Badge>
                      ) : (
                        <Text size="xs" c="dimmed">
                          Set as primary
                        </Text>
                      )
                    }
                  />
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label="Remove product"
                    onClick={() => removeProduct(product.id)}
                    disabled={products.length <= 1}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
                <TextInput
                  placeholder="Product name"
                  value={product.name}
                  onChange={(e) => patchProduct(product.id, { name: e.currentTarget.value })}
                  autoFocus={index === 0}
                />
                <Textarea
                  placeholder="A sentence on what it is and what it does."
                  value={product.description}
                  onChange={(e) =>
                    patchProduct(product.id, { description: e.currentTarget.value })
                  }
                  autosize
                  minRows={2}
                  maxRows={5}
                />
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Radio.Group>

      <Button
        variant="subtle"
        leftSection={<IconPlus size={16} />}
        onClick={addProduct}
        size="xs"
        w="fit-content"
        mt="xs"
      >
        Add another product
      </Button>
    </OnboardingShell>
  );
}
