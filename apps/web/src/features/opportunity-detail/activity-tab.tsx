import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Center,
  Checkbox,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  Textarea,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconArrowNarrowRight,
  IconCalendar,
  IconDeviceDesktop,
  IconDotsVertical,
  IconMail,
  IconNotes,
  IconPhone,
  IconPlus,
  IconScript,
  IconSparkles,
  IconTrash,
  IconUsers,
  IconVideo,
} from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { activityTypes, type ActivityType } from '@pg/shared';
import {
  isDiagnosisJobActive,
  useAddActivity,
  useDeleteActivity,
  useDiagnoses,
  useDiagnosisJobs,
  useEnqueueDiagnosis,
  type DiagnosisJob,
} from '../../mock/hooks';
import { trpc } from '../../trpc';
import { relativeTime } from '../../lib/relative-time';
import type { MockActivity, MockDiagnosis, MockOpportunity } from '../../mock/types';
import { humanize, READINESS_LABELS, readinessColor } from './badges';

interface ActivityTabProps {
  opportunity: MockOpportunity;
  activities: MockActivity[];
}

const ACTIVITY_TYPE_OPTIONS = activityTypes.map((value) => ({
  value,
  label: humanize(value),
}));

// The Activity tab (M17, PG-224) — renamed from the M6 Evidence tab. Lists every
// activity on the opportunity (one-off "Add activity" or auto-joined from the
// bulk Activities import), each with the readiness state it produced. Adding an
// activity (re)scores readiness.
export function ActivityTab({ opportunity, activities }: ActivityTabProps) {
  const navigate = useNavigate();
  const [modalOpen, { open, close }] = useDisclosure(false);
  const utils = trpc.useUtils();
  const { data: diagnoses = [] } = useDiagnoses(opportunity.id);
  const { data: jobs = [] } = useDiagnosisJobs(opportunity.id);
  const { mutateAsync: enqueueDiagnosis } = useEnqueueDiagnosis();
  const { mutateAsync: deleteActivity } = useDeleteActivity();
  // Activities whose enqueue request is in flight, so the card shows "Diagnosing…"
  // in the brief window before the running job appears in the next jobs poll.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  // The activity pending delete-confirmation, and whether the delete is in flight.
  const [pendingDelete, setPendingDelete] = useState<MockActivity | null>(null);
  const [deleting, setDeleting] = useState(false);

  const diagnosesByActivity = useMemo(() => {
    const map = new Map<string, MockDiagnosis>();
    for (const d of diagnoses) map.set(d.activityId, d);
    return map;
  }, [diagnoses]);

  // Latest job per activity (jobs come newest-first, so first-seen wins).
  const jobByActivity = useMemo(() => {
    const map = new Map<string, DiagnosisJob>();
    for (const j of jobs) if (!map.has(j.activityId)) map.set(j.activityId, j);
    return map;
  }, [jobs]);

  // Once a background run finishes, pull the resulting diagnosis (and the
  // opportunity's freshly-denormalized readiness) into view. Tracks which 'done'
  // jobs we've already reacted to so this fires exactly once per completion.
  const reactedDoneRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    let newlyDone = false;
    for (const j of jobs) {
      if (j.status === 'done' && !reactedDoneRef.current.has(j.id)) {
        reactedDoneRef.current.add(j.id);
        newlyDone = true;
      }
    }
    if (newlyDone) {
      utils.diagnosis.listForOpportunity.invalidate({ opportunityId: opportunity.id });
      utils.diagnosis.latestForOpportunity.invalidate({ opportunityId: opportunity.id });
      utils.opportunity.get.invalidate({ id: opportunity.id });
      utils.opportunity.list.invalidate();
      utils.workbench.rows.invalidate();
    }
  }, [jobs, opportunity.id, utils]);

  // Clear the optimistic "pending" flag for an activity once a real job (or its
  // diagnosis) has landed — the poll/effect drive the display from there.
  useEffect(() => {
    setPendingIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(
        [...prev].filter((id) => !jobByActivity.has(id) && !diagnosesByActivity.has(id)),
      );
      return next.size === prev.size ? prev : next;
    });
  }, [jobByActivity, diagnosesByActivity]);

  // Start (or retry) a background diagnosis for an activity. Returns immediately; the
  // jobs poll then drives the card's "Diagnosing…" → badge / failed transition.
  const handleRunForActivity = async (activityId: string) => {
    setPendingIds((prev) => new Set(prev).add(activityId));
    try {
      await enqueueDiagnosis({ activityId });
    } catch (err) {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(activityId);
        return next;
      });
      notifications.show({
        color: 'red',
        title: 'Couldn’t start the diagnosis',
        message: err instanceof Error ? err.message : 'Something went wrong. Try again.',
      });
    }
  };

  // Delete an activity (after confirmation). The API cascade-removes its diagnosis
  // and re-stamps the opportunity's readiness from whatever diagnosis remains; the
  // hook invalidates every surface that reads it, so the list self-heals.
  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteActivity({ activityId: pendingDelete.id });
      notifications.show({
        color: 'teal',
        title: 'Activity deleted',
        message: 'The activity and its diagnosis were removed.',
      });
      setPendingDelete(null);
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Couldn’t delete the activity',
        message: err instanceof Error ? err.message : 'Something went wrong. Try again.',
      });
    } finally {
      setDeleting(false);
    }
  };

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
                Add a call, email, or meeting to generate a buyer readiness diagnosis — until then,
                this deal&rsquo;s readiness is provisional.
              </Text>
              <Button leftSection={<IconPlus size={16} />} onClick={open}>
                Add activity
              </Button>
              <Anchor
                size="xs"
                c="dimmed"
                onClick={() => navigate({ to: '/buyers/new', search: { method: 'activity' } })}
                style={{ cursor: 'pointer' }}
              >
                or import your activity history from your CRM
              </Anchor>
            </Stack>
          </Paper>
        </Center>
      ) : (
        <Stack gap="sm">
          {activities.map((a) => {
            const job = jobByActivity.get(a.id) ?? null;
            const now = Date.now();
            const running = pendingIds.has(a.id) || (job != null && isDiagnosisJobActive(job, now));
            // A failed job — or one stuck 'running' past the staleness window (e.g. a
            // dev API restart orphaned it) — offers a retry.
            const failed =
              !running && job != null && (job.status === 'failed' || job.status === 'running');
            return (
              <ActivityCard
                key={a.id}
                activity={a}
                diagnosis={diagnosesByActivity.get(a.id) ?? null}
                running={running}
                failed={failed}
                jobError={failed ? (job?.error ?? null) : null}
                onRunDiagnosis={() => handleRunForActivity(a.id)}
                onDelete={() => setPendingDelete(a)}
              />
            );
          })}
        </Stack>
      )}

      <AddActivityModal
        opened={modalOpen}
        onClose={close}
        opportunity={opportunity}
        // Stay on the Activity tab so the rep watches the run progress on the card;
        // the diagnosis isn't ready synchronously anymore.
        onComplete={close}
      />

      <Modal
        opened={pendingDelete !== null}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        title="Delete activity?"
        centered
        closeOnClickOutside={!deleting}
        closeOnEscape={!deleting}
      >
        <Stack gap="md">
          <Text size="sm">
            This permanently removes the activity
            {pendingDelete && diagnosesByActivity.has(pendingDelete.id)
              ? ' and the readiness diagnosis it produced'
              : ''}
            . This can&rsquo;t be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={handleDelete}
              loading={deleting}
            >
              Delete activity
            </Button>
          </Group>
        </Stack>
      </Modal>
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
              {idx > 0 && <IconArrowNarrowRight size={16} color="var(--mantine-color-dimmed)" />}
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
  running,
  failed,
  jobError,
  onRunDiagnosis,
  onDelete,
}: {
  activity: MockActivity;
  diagnosis: MockDiagnosis | null;
  running: boolean;
  failed: boolean;
  jobError: string | null;
  onRunDiagnosis: () => void;
  onDelete: () => void;
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
          <Group gap="xs" wrap="nowrap" align="center">
            {diagnosis ? (
              <Badge variant="light" color={readinessColor(diagnosis.readinessState)} size="sm">
                {READINESS_LABELS[diagnosis.readinessState]} · {diagnosis.readinessScore}
              </Badge>
            ) : running ? (
              // The background run is in flight — the jobs poll flips this to the
              // readiness badge (or the retry button) when it settles.
              <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
                <Loader size="xs" />
                <Text size="xs" c="blue.6" fw={500}>
                  Diagnosing…
                </Text>
              </Group>
            ) : (
              // No diagnosis yet — never run, or the run failed/was orphaned. Offer a
              // one-click (re)run; gated to exactly this state so it can't re-run an
              // already-diagnosed activity.
              <Button
                size="xs"
                variant="light"
                color={failed ? 'red' : 'orange'}
                leftSection={<IconSparkles size={14} />}
                onClick={onRunDiagnosis}
                style={{ flexShrink: 0 }}
              >
                {failed ? 'Retry diagnosis' : 'Run diagnosis'}
              </Button>
            )}
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" aria-label="Activity actions">
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={onDelete}>
                  Delete activity
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        {!diagnosis && running && (
          <Text size="xs" c="dimmed">
            Running the buyer readiness diagnosis in the background — this can take a moment.
          </Text>
        )}

        {!diagnosis && failed && (
          <Group gap={6} wrap="nowrap">
            <IconAlertTriangle size={13} color="var(--mantine-color-red-6)" />
            <Text size="xs" c="dimmed">
              {jobError
                ? `Diagnosis failed: ${jobError}`
                : 'The diagnosis didn’t finish. Retry to run it again.'}
            </Text>
          </Group>
        )}

        {!diagnosis && !running && !failed && (
          <Group gap={6} wrap="nowrap">
            <IconAlertTriangle size={13} color="var(--mantine-color-orange-6)" />
            <Text size="xs" c="dimmed">
              Not diagnosed yet — run a diagnosis to score this activity.
            </Text>
          </Group>
        )}

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

function AddActivityModal({ opened, onClose, opportunity, onComplete }: AddActivityModalProps) {
  const { mutateAsync: addActivity } = useAddActivity();
  const { mutateAsync: enqueueDiagnosis } = useEnqueueDiagnosis();

  const [form, setForm] = useState<ActivityFormState>(emptyForm());
  // The quick add + enqueue round-trip (not the AI chain, which runs in the
  // background). Keeps the modal from closing mid-submit.
  const [submitting, setSubmitting] = useState(false);

  // Capture-then-update pattern. Accessing e.currentTarget inside a functional
  // state updater fails under React 18+ strict/concurrent mode because the
  // updater can be re-invoked after the synthetic event is detached.
  const updateField = <K extends keyof ActivityFormState>(key: K, value: ActivityFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const reset = () => {
    setForm(emptyForm());
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
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

    setSubmitting(true);
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

      // Kick off the real signal-extraction + diagnosis chains in the background
      // (needs ANTHROPIC_API_KEY on the API). The Activity card shows live progress;
      // the rep isn't blocked on the multi-second run.
      await enqueueDiagnosis({ activityId: activity.id });

      notifications.show({
        color: 'teal',
        title: 'Activity added',
        message:
          'Running the readiness diagnosis in the background — it’ll appear on the activity shortly.',
      });
      reset();
      onComplete();
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Something went wrong',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Add activity"
      size="lg"
      centered
      closeOnClickOutside={!submitting}
      closeOnEscape={!submitting}
      withCloseButton={!submitting}
    >
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
          <Button variant="default" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Save &amp; run diagnosis
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
