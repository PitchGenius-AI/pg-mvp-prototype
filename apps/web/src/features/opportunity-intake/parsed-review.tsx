import {
  Button,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconAlertCircle } from '@tabler/icons-react';
import { useState } from 'react';
import type { ParsedOpportunity } from '@pg/shared';
import { useCurrentProduct, useCurrentWorkspace, useSession } from '../../mock/hooks';
import { useWorkspaceStages } from '../../mock/use-workspace-stages';
import type { MockBuyer } from '../../mock/types';
import { BuyerDedupPrompt, type DedupChoice } from './buyer-dedup-prompt';
import { checkDedup, commitOpportunity, type PreSaveOpportunity } from './submit-helpers';

interface ParsedReviewProps {
  parsed: ParsedOpportunity;
  onSuccess: (opportunityId: string) => void;
  onBack: () => void;
}

interface ReviewState {
  opportunityName: string;
  buyerFirstName: string;
  buyerLastName: string;
  buyerTitle: string;
  buyerCompany: string;
  buyerEmail: string;
  buyerLinkedin: string;
  currentCrmStage: string;
  opportunityValue: number | undefined;
  expectedCloseDate: Date | null;
  knownPain: string;
  knownObjection: string;
  dealNotes: string;
}

// Tracks which fields the AI left null so we can surface "couldn't extract"
// hints in the UI even after the user edits them.
type MissingMap = Record<keyof ReviewState, boolean>;

function buildInitialState(parsed: ParsedOpportunity, fallbackStage: string) {
  const state: ReviewState = {
    opportunityName: parsed.opportunity_name ?? '',
    buyerFirstName: parsed.buyer.first_name ?? '',
    buyerLastName: parsed.buyer.last_name ?? '',
    buyerTitle: parsed.buyer.title ?? '',
    buyerCompany: parsed.buyer.company ?? '',
    buyerEmail: parsed.buyer.email ?? '',
    buyerLinkedin: parsed.buyer.linkedin ?? '',
    currentCrmStage: parsed.current_crm_stage ?? fallbackStage,
    opportunityValue: parsed.opportunity_value ?? undefined,
    expectedCloseDate: parsed.expected_close_date
      ? new Date(parsed.expected_close_date)
      : null,
    knownPain: parsed.known_pain ?? '',
    knownObjection: parsed.known_objection ?? '',
    dealNotes: parsed.deal_notes ?? '',
  };
  const missing: MissingMap = {
    opportunityName: parsed.opportunity_name == null,
    buyerFirstName: parsed.buyer.first_name == null,
    buyerLastName: parsed.buyer.last_name == null,
    buyerTitle: parsed.buyer.title == null,
    buyerCompany: parsed.buyer.company == null,
    buyerEmail: parsed.buyer.email == null,
    buyerLinkedin: parsed.buyer.linkedin == null,
    currentCrmStage: parsed.current_crm_stage == null,
    opportunityValue: parsed.opportunity_value == null,
    expectedCloseDate: parsed.expected_close_date == null,
    knownPain: parsed.known_pain == null,
    knownObjection: parsed.known_objection == null,
    dealNotes: parsed.deal_notes == null,
  };
  return { state, missing };
}

export function ParsedReview({ parsed, onSuccess, onBack }: ParsedReviewProps) {
  const stages = useWorkspaceStages();
  const { data: session } = useSession();
  const { data: workspace } = useCurrentWorkspace();
  const { data: product } = useCurrentProduct();
  const initial = buildInitialState(parsed, stages[0] ?? '');
  const [state, setState] = useState<ReviewState>(initial.state);
  const [dedupMatch, setDedupMatch] = useState<MockBuyer | null>(null);
  const [dedupOpen, setDedupOpen] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ReviewState, string>>>({});

  const update = <K extends keyof ReviewState>(key: K, value: ReviewState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const buildDraft = (): PreSaveOpportunity => ({
    buyer: {
      firstName: state.buyerFirstName.trim(),
      lastName: state.buyerLastName.trim() || null,
      title: state.buyerTitle.trim() || null,
      company: state.buyerCompany.trim(),
      email: state.buyerEmail.trim() || null,
      linkedin: state.buyerLinkedin.trim() || null,
    },
    opportunity: {
      opportunityName: state.opportunityName.trim(),
      currentCrmStage: state.currentCrmStage,
      opportunityValue: state.opportunityValue ?? null,
      expectedCloseDate: state.expectedCloseDate
        ? state.expectedCloseDate.toISOString().slice(0, 10)
        : null,
      knownPain: state.knownPain.trim() || null,
      knownObjection: state.knownObjection.trim() || null,
      dealNotes: state.dealNotes.trim() || null,
    },
  });

  const validate = (): boolean => {
    const next: Partial<Record<keyof ReviewState, string>> = {};
    if (state.opportunityName.trim().length === 0) next.opportunityName = 'Required';
    if (state.buyerFirstName.trim().length === 0) next.buyerFirstName = 'Required';
    if (state.buyerCompany.trim().length === 0) next.buyerCompany = 'Required';
    if (!state.currentCrmStage) next.currentCrmStage = 'Required';
    if (state.buyerEmail && !/^\S+@\S+\.\S+$/.test(state.buyerEmail))
      next.buyerEmail = 'Invalid email';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const performSave = (
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

  const handleSave = () => {
    if (!validate() || !workspace) return;
    const draft = buildDraft();
    const match = checkDedup(workspace.id, draft);
    if (match) {
      setDedupMatch(match);
      setDedupOpen(true);
      return;
    }
    performSave(draft, { kind: 'create' });
  };

  const handleDedupChoice = (choice: DedupChoice) => {
    const draft = buildDraft();
    if (choice === 'link' && dedupMatch) {
      performSave(draft, { kind: 'link', buyerId: dedupMatch.id });
    } else if (choice === 'create-new') {
      performSave(draft, { kind: 'create' });
    }
    setDedupMatch(null);
  };

  const missingDescription = (key: keyof MissingMap) =>
    initial.missing[key] ? (
      <Group gap={4} c="orange">
        <IconAlertCircle size={12} />
        <Text size="xs">AI couldn't extract this</Text>
      </Group>
    ) : null;

  return (
    <>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Review the extracted fields — edit anything that looks off, then save.
        </Text>
        <TextInput
          label="Opportunity name"
          required
          value={state.opportunityName}
          onChange={(e) => update('opportunityName', e.currentTarget.value)}
          error={errors.opportunityName}
          description={missingDescription('opportunityName')}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label="Buyer first name"
            required
            value={state.buyerFirstName}
            onChange={(e) => update('buyerFirstName', e.currentTarget.value)}
            error={errors.buyerFirstName}
            description={missingDescription('buyerFirstName')}
          />
          <TextInput
            label="Buyer last name"
            value={state.buyerLastName}
            onChange={(e) => update('buyerLastName', e.currentTarget.value)}
            description={missingDescription('buyerLastName')}
          />
          <TextInput
            label="Buyer company"
            required
            value={state.buyerCompany}
            onChange={(e) => update('buyerCompany', e.currentTarget.value)}
            error={errors.buyerCompany}
            description={missingDescription('buyerCompany')}
          />
          <TextInput
            label="Buyer title"
            value={state.buyerTitle}
            onChange={(e) => update('buyerTitle', e.currentTarget.value)}
            description={missingDescription('buyerTitle')}
          />
          <TextInput
            label="Buyer email"
            type="email"
            value={state.buyerEmail}
            onChange={(e) => update('buyerEmail', e.currentTarget.value)}
            error={errors.buyerEmail}
            description={missingDescription('buyerEmail')}
          />
          <TextInput
            label="Buyer LinkedIn"
            value={state.buyerLinkedin}
            onChange={(e) => update('buyerLinkedin', e.currentTarget.value)}
            description={missingDescription('buyerLinkedin')}
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label="Current CRM stage"
            data={stages}
            value={state.currentCrmStage}
            onChange={(value) => update('currentCrmStage', value ?? '')}
            error={errors.currentCrmStage}
            description={missingDescription('currentCrmStage')}
            required
          />
          <NumberInput
            label="Opportunity value"
            prefix="$"
            thousandSeparator=","
            value={state.opportunityValue}
            onChange={(v) =>
              update('opportunityValue', typeof v === 'number' ? v : undefined)
            }
            description={missingDescription('opportunityValue')}
          />
          <DateInput
            label="Expected close date"
            value={state.expectedCloseDate}
            onChange={(value) =>
              update(
                'expectedCloseDate',
                value instanceof Date ? value : value ? new Date(value) : null,
              )
            }
            description={missingDescription('expectedCloseDate')}
          />
        </SimpleGrid>
        <Textarea
          label="Known pain"
          autosize
          minRows={2}
          value={state.knownPain}
          onChange={(e) => update('knownPain', e.currentTarget.value)}
          description={missingDescription('knownPain')}
        />
        <Textarea
          label="Known objection"
          autosize
          minRows={2}
          value={state.knownObjection}
          onChange={(e) => update('knownObjection', e.currentTarget.value)}
          description={missingDescription('knownObjection')}
        />
        <Textarea
          label="Deal notes"
          autosize
          minRows={2}
          value={state.dealNotes}
          onChange={(e) => update('dealNotes', e.currentTarget.value)}
        />
        <Group justify="space-between">
          <Tooltip label="Start over with new pasted text">
            <Button variant="default" onClick={onBack}>
              Back to paste
            </Button>
          </Tooltip>
          <Button onClick={handleSave}>Save opportunity</Button>
        </Group>
      </Stack>
      <BuyerDedupPrompt
        opened={dedupOpen}
        match={dedupMatch}
        onClose={() => setDedupOpen(false)}
        onChoose={handleDedupChoice}
      />
    </>
  );
}
