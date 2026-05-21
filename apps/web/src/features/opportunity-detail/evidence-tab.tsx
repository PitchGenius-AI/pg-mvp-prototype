import {
  Anchor,
  Badge,
  Button,
  Card,
  Center,
  Checkbox,
  Group,
  Modal,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  Textarea,
  ThemeIcon,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCalendar,
  IconCheck,
  IconDeviceDesktop,
  IconLoader2,
  IconMail,
  IconNotes,
  IconPhone,
  IconPlus,
  IconScript,
  IconUsers,
  IconVideo,
} from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { activityTypes, type ActivityType } from '@pg/shared';
import { useAddActivity, useDiagnoses, useRunDiagnosis } from '../../mock/hooks';
import { FAKE_DIAGNOSIS_STEPS, fakeGenerateDiagnosis } from '../../mock/fake-diagnosis';
import { useCurrentProduct } from '../../mock/hooks';
import { useBuyerById, useCurrentSession } from '../../mock/store';
import { mockAiCall } from '../../mock/mock-api';
import { relativeTime } from '../../lib/relative-time';
import type {
  MockActivity,
  MockDiagnosis,
  MockOpportunity,
} from '../../mock/types';
import { humanize } from './badges';

interface EvidenceTabProps {
  opportunity: MockOpportunity;
  interactions: MockActivity[];
  onJumpToDiagnosis: () => void;
}

const INTERACTION_TYPE_OPTIONS = activityTypes.map((value) => ({
  value,
  label: humanize(value),
}));

export function EvidenceTab({ opportunity, interactions, onJumpToDiagnosis }: EvidenceTabProps) {
  const navigate = useNavigate();
  const [modalOpen, { open, close }] = useDisclosure(false);
  const { data: diagnoses = [] } = useDiagnoses(opportunity.id);

  const diagnosesByInteraction = new Map<string, MockDiagnosis>();
  for (const d of diagnoses) {
    diagnosesByInteraction.set(d.activityId, d);
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>Interactions ({interactions.length})</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Add interaction
        </Button>
      </Group>

      {interactions.length === 0 ? (
        <Center py="xl">
          <Paper withBorder p="lg" radius="md" maw={480}>
            <Stack align="center" gap="sm">
              <IconScript size={28} color="var(--mantine-color-dimmed)" />
              <Text fw={500}>No interactions yet</Text>
              <Text size="sm" c="dimmed" ta="center">
                Add a meeting transcript or note to generate a buyer readiness
                diagnosis — until then, this deal's readiness is provisional.
              </Text>
              <Button leftSection={<IconPlus size={16} />} onClick={open}>
                Add interaction
              </Button>
              <Anchor
                size="xs"
                c="dimmed"
                onClick={() =>
                  navigate({ to: '/buyers/new', search: { method: 'activity' } })
                }
                style={{ cursor: 'pointer' }}
              >
                or import your activity history from your CRM
              </Anchor>
            </Stack>
          </Paper>
        </Center>
      ) : (
        <Stack gap="sm">
          {interactions.map((i) => (
            <InteractionCard
              key={i.id}
              interaction={i}
              diagnosis={diagnosesByInteraction.get(i.id) ?? null}
            />
          ))}
        </Stack>
      )}

      <AddInteractionModal
        opened={modalOpen}
        onClose={close}
        opportunity={opportunity}
        onComplete={() => {
          close();
          onJumpToDiagnosis();
        }}
      />
    </Stack>
  );
}

function InteractionCard({
  interaction,
  diagnosis,
}: {
  interaction: MockActivity;
  diagnosis: MockDiagnosis | null;
}) {
  const snippet = (interaction.transcriptOrNotes ?? '').slice(0, 200).trim();
  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="xs">
            <InteractionTypeIcon type={interaction.activityType} />
            <Stack gap={0}>
              <Text fw={500} size="sm">
                {humanize(interaction.activityType)}
              </Text>
              <Text size="xs" c="dimmed">
                {new Date(interaction.activityDate).toLocaleDateString()} ·{' '}
                {relativeTime(interaction.activityDate)}
              </Text>
            </Stack>
          </Group>
          {diagnosis && (
            <Badge variant="light" size="sm">
              {humanize(diagnosis.readinessState)} · {diagnosis.readinessScore}
            </Badge>
          )}
        </Group>

        {interaction.participants.length > 0 && (
          <Group gap={4}>
            <IconUsers size={12} color="var(--mantine-color-dimmed)" />
            <Text size="xs" c="dimmed">
              {interaction.participants.join(', ')}
            </Text>
          </Group>
        )}

        {snippet && (
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {snippet}
            {interaction.transcriptOrNotes && interaction.transcriptOrNotes.length > 200 && '…'}
          </Text>
        )}

        {interaction.repSubjectiveNotes && (
          <Paper p="xs" radius="sm" style={{ background: 'var(--mantine-color-yellow-light)' }}>
            <Group gap={4} mb={2}>
              <IconNotes size={12} color="var(--mantine-color-yellow-8)" />
              <Text size="xs" fw={500} c="yellow.8">
                Rep note
              </Text>
            </Group>
            <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
              {interaction.repSubjectiveNotes}
            </Text>
          </Paper>
        )}
      </Stack>
    </Card>
  );
}

function InteractionTypeIcon({ type }: { type: ActivityType }) {
  switch (type) {
    case 'video_meeting':
    case 'demo':
      return <IconVideo size={20} color="var(--mantine-color-blue-7)" />;
    case 'call':
    case 'phone_call':
      return <IconPhone size={20} color="var(--mantine-color-teal-7)" />;
    case 'email_thread':
      return <IconMail size={20} color="var(--mantine-color-grape-7)" />;
    case 'proposal_review':
      return <IconDeviceDesktop size={20} color="var(--mantine-color-orange-7)" />;
    default:
      return <IconNotes size={20} color="var(--mantine-color-gray-7)" />;
  }
}

// --- Add Interaction modal ---

interface AddInteractionModalProps {
  opened: boolean;
  onClose: () => void;
  opportunity: MockOpportunity;
  onComplete: () => void;
}

interface InteractionFormState {
  activityType: ActivityType;
  activityDate: Date;
  participants: string[];
  transcriptOrNotes: string;
  repSubjectiveNotes: string;
  nextStepAgreed: boolean;
  stakeholderAdded: boolean;
  pricingDiscussed: boolean;
  budgetDiscussed: boolean;
  competitorDiscussed: boolean;
  implementationDiscussed: boolean;
  securityDiscussed: boolean;
}

function emptyForm(): InteractionFormState {
  return {
    activityType: 'video_meeting',
    activityDate: new Date(),
    participants: [],
    transcriptOrNotes: '',
    repSubjectiveNotes: '',
    nextStepAgreed: false,
    stakeholderAdded: false,
    pricingDiscussed: false,
    budgetDiscussed: false,
    competitorDiscussed: false,
    implementationDiscussed: false,
    securityDiscussed: false,
  };
}

function AddInteractionModal({
  opened,
  onClose,
  opportunity,
  onComplete,
}: AddInteractionModalProps) {
  const buyer = useBuyerById(opportunity.buyerId);
  const { data: product } = useCurrentProduct();
  const session = useCurrentSession();
  const { mutateAsync: addActivity } = useAddActivity();
  const { mutateAsync: runDiagnosis } = useRunDiagnosis();

  const [form, setForm] = useState<InteractionFormState>(emptyForm());
  const [running, setRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Capture-then-update pattern. Accessing e.currentTarget inside a functional
  // state updater fails under React 18+ strict/concurrent mode because the
  // updater can be re-invoked after the synthetic event is detached.
  const updateField = <K extends keyof InteractionFormState>(
    key: K,
    value: InteractionFormState[K],
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const reset = () => {
    setForm(emptyForm());
    setRunning(false);
    setStepIndex(0);
  };

  const handleClose = () => {
    if (running) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.transcriptOrNotes.trim()) {
      notifications.show({
        color: 'red',
        title: 'Add some evidence',
        message: 'Paste a transcript or notes before running the diagnosis.',
      });
      return;
    }

    setRunning(true);
    setStepIndex(0);
    const total = FAKE_DIAGNOSIS_STEPS.length;
    const interval = window.setInterval(() => {
      setStepIndex((i) => (i < total - 1 ? i + 1 : i));
    }, 600);

    try {
      const activity = await addActivity({
        workspaceId: opportunity.workspaceId,
        opportunityId: opportunity.id,
        activityType: form.activityType,
        activityDate: form.activityDate.toISOString(),
        participants: form.participants,
        transcriptOrNotes: form.transcriptOrNotes,
        repSubjectiveNotes: form.repSubjectiveNotes || null,
        nextStepAgreed: form.nextStepAgreed,
        stakeholderAdded: form.stakeholderAdded,
        pricingDiscussed: form.pricingDiscussed,
        budgetDiscussed: form.budgetDiscussed,
        competitorDiscussed: form.competitorDiscussed,
        implementationDiscussed: form.implementationDiscussed,
        securityDiscussed: form.securityDiscussed,
      });

      const { signalExtraction, diagnosis } = await mockAiCall(() =>
        fakeGenerateDiagnosis({
          opportunity,
          buyer,
          product: product ?? null,
          activity,
          repName: session?.user.name,
        }),
      );

      await runDiagnosis({
        workspaceId: opportunity.workspaceId,
        opportunityId: opportunity.id,
        activityId: activity.id,
        signalExtraction,
        diagnosis,
        readinessState: diagnosis.readiness_state,
        readinessScore: diagnosis.readiness_score,
        confidenceLevel: diagnosis.confidence_level,
        alignmentOutcome: diagnosis.pipeline_reality_check.outcome,
        alignmentLevel: diagnosis.pipeline_reality_check.level,
        alignmentReason: diagnosis.pipeline_reality_check.reason,
        primaryBlocker: diagnosis.primary_blocker,
        secondaryBlocker: diagnosis.secondary_blocker,
        crmNoteText: '',
        followUpSubject: diagnosis.follow_up_email.subject,
        followUpBody: diagnosis.follow_up_email.body,
        managerCoachingNote: diagnosis.manager_coaching_note,
      });

      notifications.show({
        color: 'teal',
        title: 'Diagnosis ready',
        message: 'New diagnosis generated from your evidence.',
      });
      reset();
      onComplete();
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Something went wrong',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      window.clearInterval(interval);
      setRunning(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Add interaction"
      size="lg"
      centered
      closeOnClickOutside={!running}
      closeOnEscape={!running}
      withCloseButton={!running}
    >
      {running ? (
        <DiagnosisRunning stepIndex={stepIndex} />
      ) : (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Stack gap={4}>
              <Text size="xs" c="dimmed">
                Type
              </Text>
              <Group gap="xs" wrap="wrap">
                {INTERACTION_TYPE_OPTIONS.map((o) => (
                  <Badge
                    key={o.value}
                    variant={form.activityType === o.value ? 'filled' : 'outline'}
                    size="md"
                    style={{ cursor: 'pointer' }}
                    onClick={() => updateField('activityType', o.value as ActivityType)}
                  >
                    {o.label}
                  </Badge>
                ))}
              </Group>
            </Stack>
            <DateInput
              label="Date"
              leftSection={<IconCalendar size={14} />}
              value={form.activityDate}
              onChange={(value) =>
                updateField(
                  'activityDate',
                  value instanceof Date ? value : value ? new Date(value) : new Date(),
                )
              }
            />
          </SimpleGrid>

          <TagsInput
            label="Participants"
            placeholder="Type a name and press Enter"
            value={form.participants}
            onChange={(value) => updateField('participants', value)}
          />

          <Textarea
            label="Transcript or notes"
            placeholder="Paste the meeting transcript, summary, or your notes here…"
            value={form.transcriptOrNotes}
            onChange={(e) => {
              const value = e.currentTarget.value;
              updateField('transcriptOrNotes', value);
            }}
            autosize
            minRows={5}
            maxRows={12}
            required
          />

          <Textarea
            label="Rep subjective notes"
            placeholder="Your own read — kept separate from buyer-attributed evidence."
            value={form.repSubjectiveNotes}
            onChange={(e) => {
              const value = e.currentTarget.value;
              updateField('repSubjectiveNotes', value);
            }}
            autosize
            minRows={2}
            description="The diagnosis weights rep-attributed claims lower than direct quotes."
          />

          <Stack gap={4}>
            <Text size="xs" c="dimmed" fw={500}>
              Checklist
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={6}>
              <Checkbox
                label="Next step agreed"
                checked={form.nextStepAgreed}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  updateField('nextStepAgreed', checked);
                }}
              />
              <Checkbox
                label="Stakeholder added"
                checked={form.stakeholderAdded}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  updateField('stakeholderAdded', checked);
                }}
              />
              <Checkbox
                label="Pricing discussed"
                checked={form.pricingDiscussed}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  updateField('pricingDiscussed', checked);
                }}
              />
              <Checkbox
                label="Budget discussed"
                checked={form.budgetDiscussed}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  updateField('budgetDiscussed', checked);
                }}
              />
              <Checkbox
                label="Competitor discussed"
                checked={form.competitorDiscussed}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  updateField('competitorDiscussed', checked);
                }}
              />
              <Checkbox
                label="Implementation discussed"
                checked={form.implementationDiscussed}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  updateField('implementationDiscussed', checked);
                }}
              />
              <Checkbox
                label="Security discussed"
                checked={form.securityDiscussed}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  updateField('securityDiscussed', checked);
                }}
              />
            </SimpleGrid>
          </Stack>

          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Save & run diagnosis</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

function DiagnosisRunning({ stepIndex }: { stepIndex: number }) {
  const total = FAKE_DIAGNOSIS_STEPS.length;
  const clamped = Math.max(0, Math.min(stepIndex, total - 1));
  // Pad the bar so it doesn't sit at 100% during the final step's work.
  const percent = Math.round(((clamped + 0.75) / total) * 100);
  return (
    <Stack gap="lg" py="lg">
      <Stack gap={4}>
        <Group justify="space-between">
          <Text fw={500} size="sm">
            Running buyer readiness diagnosis
          </Text>
          <Text size="xs" c="dimmed" fw={500}>
            {percent}%
          </Text>
        </Group>
        <Progress value={percent} size="sm" radius="xl" animated />
      </Stack>

      <Stack gap="xs">
        {FAKE_DIAGNOSIS_STEPS.map((label, i) => {
          const status = i < clamped ? 'done' : i === clamped ? 'active' : 'pending';
          return (
            <Group key={label} gap="sm" wrap="nowrap">
              <ThemeIcon
                size={22}
                radius="xl"
                variant={status === 'pending' ? 'default' : 'filled'}
                color={status === 'done' ? 'teal' : status === 'active' ? 'blue' : 'gray'}
              >
                {status === 'done' ? (
                  <IconCheck size={14} />
                ) : status === 'active' ? (
                  <IconLoader2 size={14} style={{ animation: 'pg-spin 0.9s linear infinite' }} />
                ) : (
                  <Text size="xs" c="dimmed" fw={600}>
                    {i + 1}
                  </Text>
                )}
              </ThemeIcon>
              <Text size="sm" c={status === 'pending' ? 'dimmed' : undefined} fw={status === 'active' ? 500 : 400}>
                {label}
              </Text>
            </Group>
          );
        })}
      </Stack>

      <Text size="xs" c="dimmed" ta="center">
        We'll land you on the Diagnosis tab when this completes…
      </Text>

      <style>{`@keyframes pg-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Stack>
  );
}
