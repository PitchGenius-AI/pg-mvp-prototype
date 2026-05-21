import {
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useMemo, useState } from 'react';
import { useAddOpportunity, useCurrentWorkspace, useProducts, useSession } from '../../mock/hooks';
import { useWorkspaceStages } from '../../mock/use-workspace-stages';
import type { MockBuyer } from '../../mock/types';
import { BuyerDedupPrompt, type DedupChoice } from './buyer-dedup-prompt';
import {
  buildAddOpportunityArgs,
  checkDedup,
  type BuyerStrategy,
  type PreSaveOpportunity,
} from './intake-helpers';
import { ProductField } from './product-field';

interface StructuredFormProps {
  onSuccess: (opportunityId: string) => void;
}

// Method A — Structured form (PG-210). Creates one fully-formed opportunity in a
// single step: buyer fields, a product (defaulted to primary), and optional deal
// context. The product is always assigned here, never deferred.
export function StructuredForm({ onSuccess }: StructuredFormProps) {
  const { data: session } = useSession();
  const { data: workspace } = useCurrentWorkspace();
  const { data: products } = useProducts();
  const stages = useWorkspaceStages();
  const addOpportunity = useAddOpportunity();

  const productList = useMemo(() => products ?? [], [products]);
  const primary = useMemo(
    () => productList.find((p) => p.isPrimary) ?? productList[0] ?? null,
    [productList],
  );
  const [productOverride, setProductOverride] = useState<string | null>(null);
  const productId = productOverride ?? primary?.id ?? null;

  const [dedupMatch, setDedupMatch] = useState<MockBuyer | null>(null);
  const [dedupOpen, setDedupOpen] = useState(false);

  const form = useForm({
    initialValues: {
      opportunityName: '',
      buyerFirstName: '',
      buyerLastName: '',
      buyerTitle: '',
      buyerCompany: '',
      buyerEmail: '',
      buyerLinkedin: '',
      currentCrmStage: stages[0] ?? '',
      opportunityValue: undefined as number | undefined,
      expectedCloseDate: null as Date | null,
      knownPain: '',
      knownObjection: '',
      dealNotes: '',
    },
    validate: {
      opportunityName: (v) => (v.trim().length > 0 ? null : 'Required'),
      buyerFirstName: (v) => (v.trim().length > 0 ? null : 'Required'),
      buyerCompany: (v) => (v.trim().length > 0 ? null : 'Required'),
      currentCrmStage: (v) => (v && v.length > 0 ? null : 'Required'),
      buyerEmail: (v) =>
        v.length === 0 || /^\S+@\S+\.\S+$/.test(v) ? null : 'Invalid email',
      buyerLinkedin: (v) =>
        v.length === 0 || /^https?:\/\//.test(v) ? null : 'Must start with http(s)://',
    },
  });

  const buildDraft = (): PreSaveOpportunity => ({
    buyer: {
      firstName: form.values.buyerFirstName.trim(),
      lastName: form.values.buyerLastName.trim() || null,
      title: form.values.buyerTitle.trim() || null,
      company: form.values.buyerCompany.trim(),
      email: form.values.buyerEmail.trim() || null,
      linkedin: form.values.buyerLinkedin.trim() || null,
    },
    opportunity: {
      opportunityName: form.values.opportunityName.trim(),
      currentCrmStage: form.values.currentCrmStage,
      opportunityValue: form.values.opportunityValue ?? null,
      expectedCloseDate: form.values.expectedCloseDate
        ? form.values.expectedCloseDate.toISOString().slice(0, 10)
        : null,
      knownPain: form.values.knownPain.trim() || null,
      knownObjection: form.values.knownObjection.trim() || null,
      dealNotes: form.values.dealNotes.trim() || null,
    },
  });

  const save = (draft: PreSaveOpportunity, strategy: BuyerStrategy) => {
    if (!session || !workspace || !productId) return;
    const args = buildAddOpportunityArgs(
      draft,
      { workspaceId: workspace.id, ownerUserId: session.user.id, productId },
      strategy,
    );
    addOpportunity.mutate(args, {
      onSuccess: (opportunity) => onSuccess(opportunity.id),
    });
  };

  const handleDedupChoice = (choice: DedupChoice) => {
    const draft = buildDraft();
    if (choice === 'link' && dedupMatch) {
      save(draft, { kind: 'link', buyerId: dedupMatch.id });
    } else if (choice === 'create-new') {
      save(draft, { kind: 'create' });
    }
    setDedupMatch(null);
  };

  const onSubmit = form.onSubmit(() => {
    if (!workspace) return;
    const draft = buildDraft();
    const match = checkDedup(workspace.id, draft);
    if (match) {
      setDedupMatch(match);
      setDedupOpen(true);
      return;
    }
    save(draft, { kind: 'create' });
  });

  return (
    <>
      <form onSubmit={onSubmit}>
        <Stack gap="lg">
          <Paper withBorder radius="md" p="md">
            <Stack gap="md">
              <Text size="sm" fw={600}>
                Product
              </Text>
              <ProductField
                products={productList}
                value={productId}
                onChange={setProductOverride}
              />
            </Stack>
          </Paper>

          <Stack gap="md">
            <Text size="sm" fw={600}>
              Buyer
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="First name"
                required
                {...form.getInputProps('buyerFirstName')}
              />
              <TextInput label="Last name" {...form.getInputProps('buyerLastName')} />
              <TextInput
                label="Company"
                required
                {...form.getInputProps('buyerCompany')}
              />
              <TextInput label="Title" {...form.getInputProps('buyerTitle')} />
              <TextInput
                label="Email"
                type="email"
                {...form.getInputProps('buyerEmail')}
              />
              <TextInput
                label="LinkedIn"
                placeholder="https://linkedin.com/in/…"
                {...form.getInputProps('buyerLinkedin')}
              />
            </SimpleGrid>
          </Stack>

          <Stack gap="md">
            <Text size="sm" fw={600}>
              Deal context
            </Text>
            <TextInput
              label="Opportunity name"
              placeholder="e.g. Acme – CDP renewal Q3"
              required
              {...form.getInputProps('opportunityName')}
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label="Current CRM stage"
                data={stages}
                required
                {...form.getInputProps('currentCrmStage')}
              />
              <NumberInput
                label="Opportunity value"
                prefix="$"
                thousandSeparator=","
                min={0}
                {...form.getInputProps('opportunityValue')}
              />
              <DateInput
                label="Expected close date"
                placeholder="Pick a date"
                {...form.getInputProps('expectedCloseDate')}
              />
            </SimpleGrid>
            <Textarea
              label="Known pain"
              placeholder="What problem are they trying to solve?"
              autosize
              minRows={2}
              {...form.getInputProps('knownPain')}
            />
            <Textarea
              label="Known objection"
              placeholder="Anything they've pushed back on?"
              autosize
              minRows={2}
              {...form.getInputProps('knownObjection')}
            />
            <Textarea
              label="Deal notes"
              placeholder="Anything else worth capturing"
              autosize
              minRows={2}
              {...form.getInputProps('dealNotes')}
            />
          </Stack>

          <Group justify="flex-end">
            <Button
              type="submit"
              loading={addOpportunity.isPending}
              disabled={!productId}
            >
              Save opportunity
            </Button>
          </Group>
        </Stack>
      </form>
      <BuyerDedupPrompt
        opened={dedupOpen}
        match={dedupMatch}
        onClose={() => setDedupOpen(false)}
        onChoose={handleDedupChoice}
      />
    </>
  );
}
