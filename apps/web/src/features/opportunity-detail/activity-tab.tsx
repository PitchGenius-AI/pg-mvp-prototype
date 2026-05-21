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
  IconArrowNarrowRight,
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
import { useMemo, useState } from 'react';
import { activityTypes, type ActivityType } from '@pg/shared';
import { FAKE_DIAGNOSIS_STEPS, fakeGenerateDiagnosis } from '../../mock/fake-diagnosis';
import {
  useAddActivity,
  useCurrentProduct,
  useDiagnoses,
  useRunDiagnosis,
} from '../../mock/hooks';
import { mockAiCall } from '../../mock/mock-api';
import { useBuyerById, useCurrentSession } from '../../mock/store';
import { relativeTime } from '../../lib/relative-time';
import type { MockActivity, MockDiagnosis, MockOpportunity } from '../../mock/types';
import { humanize, READINESS_LABELS, readinessColor } from './badges';

interface ActivityTabProps {
  opportunity: MockOpportunity;
  activities: MockActivity[];
  onJumpToDiagnosis: () => void;
}

const ACTIVITY_TYPE_OPTIONS = activityTypes.map((value) => ({
  value,
  label: humanize(value),
}));

// The Activity tab (M17, PG-224) — renamed from the M6 Evidence tab. Lists every
// activity on the opportunity (one-off "Add activity" or auto-joined from the
// bulk Activities import), each with the readiness state it produced. Adding an
// activity (re)scores readiness.
export function ActivityTab({ opportunity, activities, onJumpToDiagnosis }: ActivityTabProps) {
  const navigate = useNavigate();
  const [modalOpen, { open, close }] = useDisclosure(false);
  const { data: diagnoses = [] } = useDiagnoses(opportunity.id);

  const diagnosesByActivity = useMemo(() => {
    const map = new Map<string, MockDiagnosis>();
    for (const d of diagnoses) map.set(d.activityId, d);
    return map;
  }, [diagnoses]);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>Activity ({activities.length})</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Add activity
        </Button>
      </Group>

      <ReadinessTrend activities={activities} diagnosesByActivity={diagnosesByActivity} />

      {activities.length === 0 ? (
        <Center py="xl">
          <Paper withBorder p="lg" radius="md" maw={480}>
            <Stack align="center" gap="sm">
              <IconScript size={28} color="var(--mantine-color-dimmed)" />
              <Text fw={500}>No activity yet</Text>
              <Text size="sm" c="dimmed" ta="center">
                Add a call, email, or meeting to generate a buyer readiness
                diagnosis — until then, this deal&rsquo;s readiness is provisional.
              </Text>
              <Button leftSection={<IconPlus size={16} />} onClick={open}>
                Add activity
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
          {activities.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              diagnosis={diagnosesByActivity.get(a.id) ?? null}
            />
          ))}
        </Stack>
      )}

      <AddActivityModal
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

// --- Readiness trend -------------------------------------------------------

// Progression of readiness across diagnosed activities, oldest → newest. Only
// renders once a deal has two diagnoses to show movement (demo step 7).
function ReadinessTrend({
  activities,
  diagnosesByActivity,
}: {
  activities: MockActivity[];
  diagnosesByActivity: Map<string, MockDiagnosis>;
}) {
  const diagnosed = useMemo(
    () =>
      [...activities]
        .sort((a, b) => a.activityDate.localeCompare(b.activityDate))
        .map((a) => diagnosesByActivity.get(a.id))
        .filter((d): d is MockDiagnosis => d != null),
    [activities, diagnosesByActivity],
  );

  if (diagnosed.length < 2) return null;

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Text fw={600} size="sm">
          Readiness trend
        </Text>
        <Group gap="xs" wrap="wrap">
          {diagnosed.map((d, idx) => (
            <Group key={d.id} gap={4} wrap="nowrap">
              {idx > 0 && (
                <IconArrowNarrowRight size={16} color="var(--mantine-color-dimmed)" />
              )}
              <Badge variant="light" color={readinessColor(d.readinessState)} radius="sm">
                {READINESS_LABELS[d.readinessState]} · {d.readinessScore}
              </Badge>
            </Group>
          ))}
        </Group>
      </Stack>
    </Paper>
  );
}

// --- Activity card ---------------------------------------------------------

function ActivityCard({
  activity,
  diagnosis,
}: {
  activity: MockActivity;
  diagnosis: MockDiagnosis | null;
}) {
  const snippet = (activity.transcriptOrNotes ?? '').slice(0, 200).trim();
  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="xs">
            <ActivityTypeIcon type={activity.activityType} />
            <Stack gap={0}>
              <Text fw={500} size="sm">
                {humanize(activity.activityType)}
              </Text>
              <Text size="xs" c="dimmed">
                {new Date(activity.activityDate).toLocaleDateString()} ·{' '}
                {relativeTime(activity.activityDate)}
              </Text>
            </Stack>
          </Group>
          {diagnosis && (
            <Badge variant="light" color={readinessColor(diagnosis.readinessState)} size="sm">
              {READINESS_LABELS[diagnosis.readinessState]} · {diagnosis.readinessScore}
            </Badge>
          )}
        </Group>

        {activity.participants.length > 0 && (
          <Group gap={4}>
            <IconUsers size={12} color="var(--mantine-color-dimmed)" />
            <Text size="xs" c="dimmed">
              {activity.participants.join(', ')}
            </Text>
          </Group>
        )}

        {snippet && (
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {snippet}
            {activity.transcriptOrNotes && activity.transcriptOrNotes.length > 200 && '…'}
          </Text>
        )}

        {activity.repSubjectiveNotes && (
          <Paper p="xs" radius="sm" style={{ background: 'var(--mantine-color-yellow-light)' }}>
            <Group gap={4} mb={2}>
              <IconNotes size={12} color="var(--mantine-color-yellow-8)" />
              <Text size="xs" fw={500} c="yellow.8">
                Rep note
              </Text>
            </Group>
            <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
              {activity.repSubjectiveNotes}
            </Text>
          </Paper>
        )}
      </Stack>
    </Card>
  );
}

function ActivityTypeIcon({ type }: { type: ActivityType }) {
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

// --- Add Activity modal ----------------------------------------------------

interface AddActivityModalProps {
  opened: boolean;
  onClose: () => void;
  opportunity: MockOpportunity;
  onComplete: () => void;
}

interface ActivityFormState {
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

function emptyForm(): ActivityFormState {
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

function AddActivityModal({
  opened,
  onClose,
  opportunity,
  onComplete,
}: AddActivityModalProps) {
  const buyer = useBuyerById(opportunity.buyerId);
  const { data: product } = useCurrentProduct();
  const session = useCurrentSession();
  const { mutateAsync: addActivity } = useAddActivity();
  const { mutateAsync: runDiagnosis } = useRunDiagnosis();

  const [form, setForm] = useState<ActivityFormState>(emptyForm());
  const [running, setRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Capture-then-update pattern. Accessing e.currentTarget inside a functional
  // state updater fails under React 18+ strict/concurrent mode because the
  // updater can be re-invoked after the synthetic event is detached.
  const updateField = <K extends keyof ActivityFormState>(
    key: K,
    value: ActivityFormState[K],
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
        message: 'New diagnosis generated from your activity.',
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
      title="Add activity"
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
                {ACTIVITY_TYPE_OPTIONS.map((o) => (
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
            <Button onClick={handleSubmit}>Save &amp; run diagnosis</Button>
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
              <Text
                size="sm"
                c={status === 'pending' ? 'dimmed' : undefined}
                fw={status === 'active' ? 500 : 400}
              >
                {label}
              </Text>
            </Group>
          );
        })}
      </Stack>

      <Text size="xs" c="dimmed" ta="center">
        We&rsquo;ll land you on the Diagnosis tab when this completes…
      </Text>

      <style>{`@keyframes pg-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Stack>
  );
}
