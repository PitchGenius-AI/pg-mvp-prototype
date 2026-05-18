import {
  Button,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import { useCurrentProduct, useSession, useCurrentWorkspace } from '../../mock/hooks';
import { useWorkspaceStages } from '../../mock/use-workspace-stages';
import { BuyerDedupPrompt, type DedupChoice } from './buyer-dedup-prompt';
import { checkDedup, commitOpportunity, type PreSaveOpportunity } from './submit-helpers';
import type { MockBuyer } from '../../mock/types';

interface StructuredFormProps {
  onSuccess: (opportunityId: string) => void;
}

export function StructuredForm({ onSuccess }: StructuredFormProps) {
  const { data: session } = useSession();
  const { data: workspace } = useCurrentWorkspace();
  const { data: product } = useCurrentProduct();
  const stages = useWorkspaceStages();

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

  const handleSave = (
    draft: PreSaveOpportunity,
    strategy: { kind: 'create' } | { kind: 'link'; buyerId: string },
  ) => {
    if (!session || !workspace || !product) return;
    const result = commitOpportunity(
      draft,
      {
        workspaceId: workspace.id,
        ownerUserId: session.user.id,
        productId: product.id,
      },
      strategy,
    );
    onSuccess(result.opportunity.id);
  };

  const handleDedupChoice = (choice: DedupChoice) => {
    const draft = buildDraft();
    if (choice === 'link' && dedupMatch) {
      handleSave(draft, { kind: 'link', buyerId: dedupMatch.id });
    } else if (choice === 'create-new') {
      handleSave(draft, { kind: 'create' });
    }
    setDedupMatch(null);
  };

  const onSubmit = form.onSubmit((_values) => {
    if (!workspace) return;
    const draft = buildDraft();
    const match = checkDedup(workspace.id, draft);
    if (match) {
      setDedupMatch(match);
      setDedupOpen(true);
      return;
    }
    handleSave(draft, { kind: 'create' });
  });

  return (
    <>
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          <TextInput
            label="Opportunity name"
            placeholder="e.g. Acme – CDP renewal Q3"
            required
            {...form.getInputProps('opportunityName')}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Buyer first name"
              required
              {...form.getInputProps('buyerFirstName')}
            />
            <TextInput label="Buyer last name" {...form.getInputProps('buyerLastName')} />
            <TextInput
              label="Buyer company"
              required
              {...form.getInputProps('buyerCompany')}
            />
            <TextInput label="Buyer title" {...form.getInputProps('buyerTitle')} />
            <TextInput
              label="Buyer email"
              type="email"
              {...form.getInputProps('buyerEmail')}
            />
            <TextInput
              label="Buyer LinkedIn"
              placeholder="https://linkedin.com/in/…"
              {...form.getInputProps('buyerLinkedin')}
            />
          </SimpleGrid>
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
          <Group justify="flex-end">
            <Button type="submit">Save opportunity</Button>
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
