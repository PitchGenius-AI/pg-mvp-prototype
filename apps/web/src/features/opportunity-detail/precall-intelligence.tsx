import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Tooltip,
  TypographyStylesProvider,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconBrain,
  IconCheck,
  IconRefresh,
  IconScript,
  IconSparkles,
  IconTargetArrow,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type {
  DiscType,
  GeneratedScript,
  PsychProfile,
} from '@pg/shared';
import { DISC_TYPE_LABELS, FAKE_PRECALL_STEPS, TECHNIQUE_LABELS } from '../../mock/fake-precall';
import {
  usePrecallIntelligence,
  useRunPrecall,
  useUpdatePrecallScript,
} from '../../mock/hooks';
import type {
  MockBuyer,
  MockDiagnosis,
  MockOpportunity,
  MockPrecallIntelligence,
} from '../../mock/types';

interface PrecallIntelligenceProps {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
  latestDiagnosis: MockDiagnosis | null;
}

// The pre-call intelligence block on the Overview tab (M17, PG-222/PG-223):
// a DISC/OCEAN psychological profile, a matched sales technique, and a generated
// pre-call script. Generated from enrichment on first view (no activity needed)
// and cached per opportunity; the script is editable + regenerable.
export function PrecallIntelligence({
  opportunity,
  buyer,
  latestDiagnosis,
}: PrecallIntelligenceProps) {
  const { data: precall, isLoading } = usePrecallIntelligence(opportunity.id);
  const { mutateAsync: runPrecall } = useRunPrecall();
  const { mutateAsync: updateScript } = useUpdatePrecallScript();

  const [stepIndex, setStepIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const triggered = useRef(false);
  const intervalRef = useRef<number | null>(null);

  // Clean up the stepper interval if the tab unmounts mid-generation.
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, []);

  const runGeneration = async () => {
    setFailed(false);
    setStepIndex(0);
    intervalRef.current = window.setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, FAKE_PRECALL_STEPS.length - 1));
    }, 650);
    try {
      // The server generates the DISC/OCEAN profile + matched technique + script.
      await runPrecall({ opportunityId: opportunity.id });
    } catch {
      setFailed(true);
    } finally {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };

  // Generate on first view once the query has settled and nothing exists.
  useEffect(() => {
    if (!isLoading && !precall && !triggered.current) {
      triggered.current = true;
      void runGeneration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, precall]);

  const handleRegenerateScript = async () => {
    if (!precall) return;
    setRegenerating(true);
    try {
      await runPrecall({ opportunityId: opportunity.id });
      notifications.show({
        color: 'teal',
        title: 'Pre-call intelligence regenerated',
        message: 'A fresh read and script for this buyer.',
      });
    } catch {
      notifications.show({
        color: 'red',
        title: 'Couldn’t regenerate',
        message: 'Something went wrong. Try again.',
      });
    } finally {
      setRegenerating(false);
    }
  };

  const handleSaveScript = async (sections: GeneratedScript['sections']) => {
    if (!precall) return;
    await updateScript({ opportunityId: opportunity.id, sections });
    notifications.show({
      color: 'teal',
      title: 'Script saved',
      message: 'Your edits to the pre-call script are saved.',
    });
  };

  if (failed) {
    return (
      <SectionCard
        icon={<IconSparkles size={18} />}
        title="Pre-call intelligence"
      >
        <Stack align="center" gap="sm" py="md">
          <Text size="sm" c="dimmed" ta="center">
            Couldn&rsquo;t generate the pre-call intelligence for this buyer.
          </Text>
          <Button
            size="xs"
            variant="default"
            leftSection={<IconRefresh size={14} />}
            onClick={() => void runGeneration()}
          >
            Try again
          </Button>
        </Stack>
      </SectionCard>
    );
  }

  // No bundle yet — it is loading, generating, or about to. The stepped card
  // covers all three; once the bundle exists we render the real sections.
  if (!precall) {
    return <GeneratingCard stepIndex={stepIndex} />;
  }

  return (
    <Stack gap="md">
      <Group gap="xs">
        <IconSparkles size={18} color="var(--mantine-color-violet-6)" />
        <Text fw={600}>Pre-call intelligence</Text>
        <Tooltip
          multiline
          w={300}
          label="Generated from buyer enrichment so you can prep before the conversation. No activity required — it's ready the moment the opportunity exists."
        >
          <IconSparkles size={13} color="var(--mantine-color-dimmed)" />
        </Tooltip>
      </Group>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <ProfileCard profile={precall.psychProfile} />
        <Stack gap="md">
          <TechniqueCard precall={precall} />
          <ScriptCard
            precall={precall}
            regenerating={regenerating}
            onRegenerate={handleRegenerateScript}
            onSave={handleSaveScript}
          />
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}

// --- Generating animation --------------------------------------------------

function GeneratingCard({ stepIndex }: { stepIndex: number }) {
  const clamped = Math.max(0, Math.min(stepIndex, FAKE_PRECALL_STEPS.length - 1));
  return (
    <SectionCard icon={<IconSparkles size={18} />} title="Pre-call intelligence">
      <Stack gap="md" py="xs">
        <Text size="sm" c="dimmed">
          Reading the buyer&rsquo;s profile and preparing your pre-call brief&hellip;
        </Text>
        <Stack gap="xs">
          {FAKE_PRECALL_STEPS.map((label, i) => {
            const status = i < clamped ? 'done' : i === clamped ? 'active' : 'pending';
            return (
              <Group key={label} gap="sm" wrap="nowrap">
                <ThemeIcon
                  size={22}
                  radius="xl"
                  variant={status === 'pending' ? 'default' : 'filled'}
                  color={
                    status === 'done' ? 'teal' : status === 'active' ? 'violet' : 'gray'
                  }
                >
                  {status === 'done' ? (
                    <IconCheck size={14} />
                  ) : status === 'active' ? (
                    <Loader size={12} color="white" />
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
      </Stack>
    </SectionCard>
  );
}

// --- Psychological profile -------------------------------------------------

const DISC_ROWS: DiscType[] = ['D', 'I', 'S', 'C'];

const OCEAN_ROWS: { key: keyof PsychProfile['ocean']; label: string }[] = [
  { key: 'o', label: 'Openness' },
  { key: 'c', label: 'Conscientiousness' },
  { key: 'e', label: 'Extraversion' },
  { key: 'a', label: 'Agreeableness' },
  { key: 'n', label: 'Neuroticism' },
];

function ProfileCard({ profile }: { profile: PsychProfile }) {
  const { disc, ocean } = profile;
  const discValue = (t: DiscType): number =>
    t === 'D' ? disc.d : t === 'I' ? disc.i : t === 'S' ? disc.s : disc.c;

  return (
    <SectionCard icon={<IconBrain size={18} />} title="Buyer psychological profile">
      <Stack gap="lg">
        <Text size="sm">{profile.summary}</Text>
        <Stack gap={8}>
          <Group gap="xs">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              DISC
            </Text>
            <Badge size="xs" variant="light" color="blue">
              {disc.primaryType} · {DISC_TYPE_LABELS[disc.primaryType]}
            </Badge>
          </Group>
          {DISC_ROWS.map((t) => (
            <TraitRow
              key={t}
              label={DISC_TYPE_LABELS[t]}
              value={discValue(t)}
              color="blue"
              highlighted={t === disc.primaryType}
            />
          ))}
        </Stack>
        <Stack gap={8}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            OCEAN · Big Five
          </Text>
          {OCEAN_ROWS.map((row) => (
            <TraitRow
              key={row.key}
              label={row.label}
              value={ocean[row.key]}
              color="grape"
            />
          ))}
        </Stack>
      </Stack>
    </SectionCard>
  );
}

function TraitRow({
  label,
  value,
  color,
  highlighted = false,
}: {
  label: string;
  value: number;
  color: string;
  highlighted?: boolean;
}) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Text size="xs" w={128} fw={highlighted ? 700 : 400} style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Progress
        value={value}
        color={highlighted ? `${color}.7` : `${color}.4`}
        size={highlighted ? 'md' : 'sm'}
        radius="xl"
        style={{ flex: 1 }}
      />
      <Text size="xs" w={26} ta="right" fw={highlighted ? 700 : 600} style={{ flexShrink: 0 }}>
        {value}
      </Text>
    </Group>
  );
}

// --- Matched technique -----------------------------------------------------

function TechniqueCard({ precall }: { precall: MockPrecallIntelligence }) {
  const { technique, reasoning } = precall.matchedTechnique;
  return (
    <SectionCard icon={<IconTargetArrow size={18} />} title="Matched sales technique">
      <Stack gap="sm">
        <Badge size="lg" variant="filled" color="violet">
          {TECHNIQUE_LABELS[technique]}
        </Badge>
        <Text size="sm">{reasoning}</Text>
      </Stack>
    </SectionCard>
  );
}

// --- Generated script ------------------------------------------------------

// The compact script card — it shows which technique the script uses plus a
// one-line rationale, and opens the full script in a modal for review/editing.
// Kept small so it can sit alongside the matched-technique card in one row.
function ScriptCard({
  precall,
  regenerating,
  onRegenerate,
  onSave,
}: {
  precall: MockPrecallIntelligence;
  regenerating: boolean;
  onRegenerate: () => void;
  onSave: (sections: GeneratedScript['sections']) => Promise<void>;
}) {
  const script = precall.generatedScript;
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <SectionCard icon={<IconScript size={18} />} title="Pre-call script">
        <Stack gap="sm" style={{ flex: 1 }} justify="space-between">
          <Stack gap="xs">
            <Group gap="xs">
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Technique
              </Text>
              <Badge size="sm" variant="light" color="violet">
                {TECHNIQUE_LABELS[script.technique]}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {script.basedOnTemplateId
                ? 'Adapted from your workspace script template for this buyer.'
                : 'Generated from scratch for this buyer — no workspace template.'}
            </Text>
          </Stack>
          <Button
            variant="light"
            leftSection={<IconScript size={16} />}
            onClick={open}
            style={{ alignSelf: 'flex-start' }}
          >
            Review script
          </Button>
        </Stack>
      </SectionCard>
      <ScriptModal
        opened={opened}
        onClose={close}
        script={script}
        regenerating={regenerating}
        onRegenerate={onRegenerate}
        onSave={onSave}
      />
    </>
  );
}

// The full pre-call script, opened from the compact card. Renders the script as
// markdown for review; Edit and Regenerate live here so the card stays minimal.
function ScriptModal({
  opened,
  onClose,
  script,
  regenerating,
  onRegenerate,
  onSave,
}: {
  opened: boolean;
  onClose: () => void;
  script: GeneratedScript;
  regenerating: boolean;
  onRegenerate: () => void;
  onSave: (sections: GeneratedScript['sections']) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<GeneratedScript['sections']>(script.sections);
  const [saving, setSaving] = useState(false);

  // Compose the script sections into markdown for the read view.
  const markdown = useMemo(
    () => script.sections.map((s) => `## ${s.heading}\n\n${s.body}`).join('\n\n'),
    [script.sections],
  );

  const startEdit = () => {
    setDraft(script.sections.map((s) => ({ ...s })));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(script.sections);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (idx: number, patch: Partial<GeneratedScript['sections'][number]>) => {
    setDraft((d) => d.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      title={
        <Group gap="xs">
          <IconScript size={18} color="var(--mantine-color-gray-6)" />
          <Text fw={600}>Pre-call script</Text>
          <Badge size="sm" variant="light" color="violet">
            {TECHNIQUE_LABELS[script.technique]}
          </Badge>
        </Group>
      }
    >
      <Stack gap="md">
        <Group justify="flex-end">
          {editing ? (
            <Group gap="xs">
              <Button size="xs" variant="default" onClick={cancelEdit} disabled={saving}>
                Cancel
              </Button>
              <Button size="xs" onClick={() => void save()} loading={saving}>
                Save
              </Button>
            </Group>
          ) : (
            <Group gap="xs">
              <Button
                size="xs"
                variant="default"
                onClick={startEdit}
                disabled={regenerating}
              >
                Edit
              </Button>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconRefresh size={14} />}
                onClick={onRegenerate}
                loading={regenerating}
              >
                Regenerate
              </Button>
            </Group>
          )}
        </Group>

        {editing ? (
          <Stack gap="md">
            {draft.map((section, idx) => (
              <Stack key={idx} gap={6}>
                <TextInput
                  size="xs"
                  label={`Section ${idx + 1} heading`}
                  value={section.heading}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    updateSection(idx, { heading: value });
                  }}
                />
                <Textarea
                  size="sm"
                  value={section.body}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    updateSection(idx, { body: value });
                  }}
                  autosize
                  minRows={2}
                  maxRows={6}
                />
              </Stack>
            ))}
          </Stack>
        ) : (
          <TypographyStylesProvider>
            <ReactMarkdown>{markdown}</ReactMarkdown>
          </TypographyStylesProvider>
        )}
      </Stack>
    </Modal>
  );
}

// --- Shared card shell -----------------------------------------------------

function SectionCard({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap="xs">
            <ActionIcon variant="transparent" color="gray" size="sm" aria-hidden>
              {icon}
            </ActionIcon>
            <Text fw={600} size="sm">
              {title}
            </Text>
          </Group>
          {action}
        </Group>
        {children}
      </Stack>
    </Paper>
  );
}
