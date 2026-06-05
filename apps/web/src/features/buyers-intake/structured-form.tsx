import {
  Alert,
  Anchor,
  Button,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { IconArrowLeft, IconInfoCircle, IconSparkles } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import type { BuyerEnrichment, EnrichSource } from '../../mock/fake-enrich';
import { useAddOpportunity, useCurrentWorkspace, useProducts, useSession } from '../../mock/hooks';
import type { MockBuyer } from '../../mock/types';
import { useWorkspaceStages } from '../../mock/use-workspace-stages';
import { BuyerDedupPrompt, type DedupChoice } from './buyer-dedup-prompt';
import { BuyerLookup } from './buyer-lookup';
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

// lookup → buyer (confirm who they are) → deal (product + deal context, then save).
type Phase = 'lookup' | 'buyer' | 'deal';
const PHASE_INDEX: Record<Phase, number> = { lookup: 0, buyer: 1, deal: 2 };

// Buyer-step fields with validators — re-checked before advancing to the deal
// step so the rep can't carry invalid buyer data forward.
const BUYER_FIELDS = [
  'buyerFirstName',
  'buyerCompany',
  'buyerEmail',
  'buyerLinkedin',
  'buyerWebsite',
] as const;

// Human label for the buyer fields the lookup pre-filled, for the "we found…"
// banner. Order matches how they read on the form.
const ENRICH_FIELD_LABELS: Array<[keyof BuyerEnrichment, string]> = [
  ['firstName', 'name'],
  ['title', 'title'],
  ['company', 'company'],
  ['email', 'email'],
  ['linkedin', 'LinkedIn'],
  ['website', 'website'],
];

function filledLabels(enrichment: BuyerEnrichment): string[] {
  const labels: string[] = [];
  for (const [key, label] of ENRICH_FIELD_LABELS) {
    // firstName covers the name pair; skip lastName so it isn't double-counted.
    if (enrichment[key]) labels.push(label);
  }
  return labels;
}

// Method A — Manual Entry (PG-210, reworked). A short wizard: (1) look a buyer up
// by email or LinkedIn so the mock enrichment can pre-fill what it can,
// (2) confirm the buyer information, then (3) add the product + deal context and
// save one fully-formed opportunity. The product is always assigned here, never
// deferred.
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

  const [phase, setPhase] = useState<Phase>('lookup');
  // What the lookup found — drives the banner on the buyer step. Null when the
  // rep skipped enrichment and went straight to a blank form.
  const [enriched, setEnriched] = useState<{ source: EnrichSource; labels: string[] } | null>(
    null,
  );

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
      buyerWebsite: '',
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
      buyerWebsite: (v) =>
        v.length === 0 || /^https?:\/\//.test(v) ? null : 'Must start with http(s)://',
    },
  });

  // Pre-fill the form from a lookup result and move to the buyer step. Fields
  // enrichment couldn't determine stay blank with their required markers intact.
  const handleResolve = (source: EnrichSource, enrichment: BuyerEnrichment) => {
    form.setValues({
      buyerFirstName: enrichment.firstName ?? '',
      buyerLastName: enrichment.lastName ?? '',
      buyerTitle: enrichment.title ?? '',
      buyerCompany: enrichment.company ?? '',
      buyerEmail: enrichment.email ?? '',
      buyerLinkedin: enrichment.linkedin ?? '',
      buyerWebsite: enrichment.website ?? '',
    });
    const labels = filledLabels(enrichment);
    setEnriched(labels.length > 0 ? { source, labels } : null);
    setPhase('buyer');
  };

  const handleSkip = () => {
    setEnriched(null);
    setPhase('buyer');
  };

  const startOver = () => {
    form.reset();
    setEnriched(null);
    setPhase('lookup');
  };

  // Advance buyer → deal only once the buyer fields validate.
  const goToDeal = () => {
    const hasError = BUYER_FIELDS.map((f) => form.validateField(f)).some((r) => r.hasError);
    if (!hasError) setPhase('deal');
  };

  // Stepper back-navigation: allow returning to an earlier step only.
  const handleStepClick = (index: number) => {
    if (index >= PHASE_INDEX[phase]) return;
    if (index === 0) setPhase('lookup');
    else if (index === 1) setPhase('buyer');
  };

  const buildDraft = (): PreSaveOpportunity => ({
    buyer: {
      firstName: form.values.buyerFirstName.trim(),
      lastName: form.values.buyerLastName.trim() || null,
      title: form.values.buyerTitle.trim() || null,
      company: form.values.buyerCompany.trim(),
      email: form.values.buyerEmail.trim() || null,
      linkedin: form.values.buyerLinkedin.trim() || null,
      website: form.values.buyerWebsite.trim() || null,
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
      <Stepper
        active={PHASE_INDEX[phase]}
        onStepClick={handleStepClick}
        size="sm"
        mb="xl"
        allowNextStepsSelect={false}
      >
        <Stepper.Step label="Find" description="Email or LinkedIn" />
        <Stepper.Step label="Buyer" description="Confirm who they are" />
        <Stepper.Step label="Deal" description="Product & context" />
      </Stepper>

      {phase === 'lookup' && <BuyerLookup onResolve={handleResolve} onSkip={handleSkip} />}

      {phase === 'buyer' && (
        <Stack gap="lg">
          {enriched ? (
            <Alert
              color="teal"
              variant="light"
              icon={<IconSparkles size={18} />}
              title={`We pre-filled this from ${
                enriched.source === 'email' ? 'their email' : 'their LinkedIn'
              }`}
            >
              <Text size="sm">
                Pulled in {enriched.labels.join(', ')}. Review and fill in anything
                we missed.
              </Text>
            </Alert>
          ) : (
            <Text size="sm" c="dimmed">
              Enter the buyer’s details.
            </Text>
          )}

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="First name"
              required
              {...form.getInputProps('buyerFirstName')}
            />
            <TextInput label="Last name" {...form.getInputProps('buyerLastName')} />
            <TextInput label="Company" required {...form.getInputProps('buyerCompany')} />
            <TextInput label="Title" {...form.getInputProps('buyerTitle')} />
            <TextInput label="Email" type="email" {...form.getInputProps('buyerEmail')} />
            <TextInput
              label="LinkedIn"
              placeholder="https://linkedin.com/in/…"
              {...form.getInputProps('buyerLinkedin')}
            />
            <TextInput
              label="Website"
              placeholder="https://…"
              {...form.getInputProps('buyerWebsite')}
            />
          </SimpleGrid>

          <Group justify="space-between">
            <Anchor
              component="button"
              type="button"
              size="sm"
              c="dimmed"
              onClick={startOver}
            >
              Start over
            </Anchor>
            <Button onClick={goToDeal}>Continue to deal context</Button>
          </Group>
        </Stack>
      )}

      {phase === 'deal' && (
        <form onSubmit={onSubmit}>
          <Stack gap="lg">
            <Alert color="blue" variant="light" icon={<IconInfoCircle size={18} />}>
              <Text size="sm">
                Deal context powers the readiness diagnosis and the Pipeline
                Reality Check — comparing your CRM stage to the buyer’s
                evidence-based readiness so over-projected deals get flagged. The
                more you add, the sharper the read.
              </Text>
            </Alert>

            <Stack gap="md">
              <Text size="sm" fw={600}>
                Deal context
              </Text>
              <ProductField
                products={productList}
                value={productId}
                onChange={setProductOverride}
              />
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

            <Group justify="space-between">
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconArrowLeft size={15} />}
                onClick={() => setPhase('buyer')}
              >
                Back to buyer
              </Button>
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
      )}

      <BuyerDedupPrompt
        opened={dedupOpen}
        match={dedupMatch}
        onClose={() => setDedupOpen(false)}
        onChoose={handleDedupChoice}
      />
    </>
  );
}
